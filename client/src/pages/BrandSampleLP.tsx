import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Rocket, TrendingUp, Users, Video, CheckCircle2, ArrowRight,
  Zap, Shield, BarChart3, Star, ChevronDown, Play, Target,
  Award, Clock, Eye, ShoppingCart, Sparkles, ChevronRight,
  Building2, Mail, Phone, Globe, FileText, Send, Mic, Radio,
  MessageSquare, Heart, ThumbsUp, Store, X
} from "lucide-react";

const LCJ_LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663045992616/GgA9WvTBCZMf6mjyMMwACw/lcj_logo_e21ead0b.jpg";

// ============================================================
// Brand Results Data
// ============================================================
const BRAND_RESULTS = [
  { name: "KYOGOKU", amount: "1億円", amountNum: 100000000, color: "from-red-600 to-amber-500" },
  { name: "DDS RENOVATIO", amount: "550万円", amountNum: 5500000, color: "from-purple-600 to-pink-500" },
  { name: "mistine", amount: "180万円", amountNum: 1800000, color: "from-blue-600 to-cyan-500" },
  { name: "RECORE SERUM", amount: "180万円", amountNum: 1800000, color: "from-emerald-600 to-teal-500" },
  { name: "Spatreatment", amount: "150万円", amountNum: 1500000, color: "from-amber-600 to-yellow-500" },
  { name: "F&W", amount: "160万円", amountNum: 1600000, color: "from-gray-700 to-gray-500" },
];

// ============================================================
// Animated Counter Component
// ============================================================
function AnimatedCounter({ end, duration = 2000, prefix = "", suffix = "" }: {
  end: number; duration?: number; prefix?: string; suffix?: string;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let startTime: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [started, end, duration]);

  return <div ref={ref}>{prefix}{count.toLocaleString()}{suffix}</div>;
}

// ============================================================
// Brand Result Card (Scrolling Ticker)
// ============================================================
function BrandResultsTicker() {
  return (
    <div className="overflow-hidden py-4">
      <div className="flex animate-scroll gap-6" style={{ width: "max-content" }}>
        {[...BRAND_RESULTS, ...BRAND_RESULTS, ...BRAND_RESULTS].map((brand, i) => (
          <div key={i} className="flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-5 py-3 shrink-0">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${brand.color} flex items-center justify-center text-white font-black text-xs`}>
              {brand.name.charAt(0)}
            </div>
            <div>
              <p className="text-white/80 text-xs font-medium">{brand.name}</p>
              <p className="text-white font-black text-lg">{brand.amount}<span className="text-white/60 text-xs">+</span></p>
            </div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .animate-scroll {
          animation: scroll 25s linear infinite;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}

// ============================================================
// Inline CTA Button (散りばめ用)
// ============================================================
function InlineCTA({ onClick, text = "無料で審査に申し込む", variant = "primary" }: {
  onClick: () => void; text?: string; variant?: "primary" | "secondary" | "dark";
}) {
  const styles = {
    primary: "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-2xl shadow-purple-500/30",
    secondary: "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-2xl shadow-amber-500/30",
    dark: "bg-white text-gray-900 hover:bg-gray-100 shadow-2xl",
  };
  return (
    <div className="text-center my-8">
      <Button
        onClick={onClick}
        className={`${styles[variant]} px-10 py-6 text-lg font-bold rounded-xl transition-all hover:scale-105`}
      >
        {text} <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
      <p className="text-xs text-gray-400 mt-2 flex items-center justify-center gap-1">
        <Clock className="h-3 w-3" />
        入力30秒・初期費用0円
      </p>
    </div>
  );
}

// ============================================================
// Urgency Badge
// ============================================================
function UrgencyBadge() {
  const [remaining] = useState(() => Math.floor(Math.random() * 5) + 3); // 3-7
  const now = new Date();
  const deadline = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const deadlineStr = `${deadline.getMonth() + 1}/${deadline.getDate()}`;
  return (
    <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 rounded-full px-4 py-2 text-sm font-medium animate-pulse">
      <Zap className="h-4 w-4" />
      今月の審査枠 残り<span className="font-black text-red-600">{remaining}ブランド</span>
      <span className="text-red-400">|</span>
      締切 {deadlineStr}
    </div>
  );
}

// ============================================================
// Plan Card Component (Updated: opens modal)
// ============================================================
function PlanCard({ plan, isPopular, onSelect }: {
  plan: { id: string; name: string; samples: number; price: string; features: string[]; color: string; gradient: string; icon: React.ReactNode; tagline: string };
  isPopular: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`relative rounded-2xl border-2 p-6 transition-all duration-300 hover:scale-[1.02] ${
        isPopular
          ? "border-purple-300 shadow-xl shadow-purple-500/10"
          : "border-gray-200 shadow-md hover:shadow-lg"
      }`}
      style={{ background: isPopular ? plan.gradient : "white" }}
    >
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold px-6 py-1.5 rounded-full shadow-lg animate-pulse">
          一番人気
        </div>
      )}
      <div className="text-center">
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 ${isPopular ? "bg-white/20" : plan.color}`}>
          {plan.icon}
        </div>
        <h3 className={`text-xl font-bold mb-1 ${isPopular ? "text-white" : "text-gray-900"}`}>{plan.name}</h3>
        <p className={`text-sm mb-4 ${isPopular ? "text-white/80" : "text-gray-500"}`}>{plan.tagline}</p>
        <div className={`text-5xl font-black mb-1 ${isPopular ? "text-white" : "text-gray-900"}`}>
          {plan.samples}<span className="text-lg font-medium">個</span>
        </div>
        <p className={`text-sm mb-6 ${isPopular ? "text-white/70" : "text-gray-400"}`}>{plan.price}</p>
        <ul className="space-y-3 text-left mb-6">
          {plan.features.map((f, i) => (
            <li key={i} className={`flex items-start gap-2 text-sm ${isPopular ? "text-white/90" : "text-gray-600"}`}>
              <CheckCircle2 className={`h-4 w-4 mt-0.5 shrink-0 ${isPopular ? "text-white" : "text-green-500"}`} />
              {f}
            </li>
          ))}
        </ul>
        <Button
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className={`w-full py-4 text-base font-bold rounded-xl transition-all hover:scale-[1.03] ${
            isPopular
              ? "bg-white text-purple-700 hover:bg-white/90 shadow-lg"
              : "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-lg"
          }`}
        >
          このプランで申し込む <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Application Modal (2-step form)
// ============================================================
function ApplicationModal({ isOpen, onClose, plan, plans }: {
  isOpen: boolean;
  onClose: () => void;
  plan: string;
  plans: { id: string; name: string; samples: number }[];
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState({
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    brandName: "",
    productUrl: "",
    productStrength: "",
    pastSalesRecord: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(plan);

  useEffect(() => {
    setSelectedPlan(plan);
  }, [plan]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const submitMutation = trpc.brandSample.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("審査申込を受け付けました！3営業日以内にご連絡いたします。");
    },
    onError: (err) => {
      toast.error("送信に失敗しました: " + err.message);
      setIsSubmitting(false);
    },
  });

  const handleStep1Next = () => {
    if (!formData.companyName || !formData.contactPerson || !formData.email) {
      toast.error("会社名・担当者名・メールアドレスを入力してください");
      return;
    }
    setStep(2);
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    const p = plans.find((pp) => pp.id === selectedPlan)!;
    submitMutation.mutate({
      companyName: formData.companyName,
      contactPerson: formData.contactPerson,
      email: formData.email,
      phone: formData.phone,
      brandName: formData.brandName || "未入力",
      productUrl: formData.productUrl || "未入力",
      productStrength: formData.productStrength || "未入力",
      pastSalesRecord: formData.pastSalesRecord,
      plan: selectedPlan as "light" | "algorithm" | "market_jack",
      sampleCount: p.samples,
    });
  };

  const handleSkipSubmit = () => {
    setIsSubmitting(true);
    const p = plans.find((pp) => pp.id === selectedPlan)!;
    submitMutation.mutate({
      companyName: formData.companyName,
      contactPerson: formData.contactPerson,
      email: formData.email,
      phone: formData.phone,
      brandName: "未入力（後日ご連絡）",
      productUrl: "未入力",
      productStrength: "未入力（後日ご連絡）",
      pastSalesRecord: "",
      plan: selectedPlan as "light" | "algorithm" | "market_jack",
      sampleCount: p.samples,
    });
  };

  if (!isOpen) return null;

  const currentPlan = plans.find((p) => p.id === selectedPlan);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors z-10">
          <X className="h-5 w-5 text-gray-400" />
        </button>

        {submitted ? (
          /* Success State */
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-green-500/30">
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-3">申込を受け付けました！</h2>
            <p className="text-gray-600 mb-2">3営業日以内にスタッフよりご連絡いたします。</p>
            <p className="text-sm text-gray-400 mb-6">選択プラン: {currentPlan?.name}（サンプル{currentPlan?.samples}個）</p>
            <div className="bg-gray-50 rounded-xl p-5 text-left mb-6">
              <h3 className="font-bold text-gray-900 mb-3 text-sm">次のステップ</h3>
              <div className="space-y-2">
                {["スタッフからメールまたはお電話でご連絡", "商品の詳細をヒアリング", "審査結果をお知らせ（通過率約30%）"].map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</div>
                    <p className="text-sm text-gray-600">{s}</p>
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={onClose} className="w-full bg-gray-900 text-white hover:bg-gray-800 py-3 rounded-xl font-bold">
              閉じる
            </Button>
          </div>
        ) : step === 1 ? (
          /* Step 1: Quick Info */
          <div className="p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 rounded-full px-4 py-1.5 text-xs font-bold mb-3">
                <Zap className="h-3 w-3" />
                入力30秒で完了
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">まずはお気軽にご連絡ください</h2>
              <p className="text-sm text-gray-500">スタッフが詳細をヒアリングしてご提案します</p>
            </div>

            {/* Plan selector */}
            <div className="flex gap-1.5 mb-6 p-1 bg-gray-100 rounded-xl">
              {plans.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlan(p.id)}
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                    selectedPlan === p.id
                      ? "bg-white text-purple-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 mb-1.5 block font-medium">会社名 <span className="text-red-500">*</span></label>
                <Input
                  placeholder="株式会社〇〇"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="py-3"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1.5 block font-medium">ご担当者名 <span className="text-red-500">*</span></label>
                <Input
                  placeholder="山田 太郎"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="py-3"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1.5 block font-medium">メールアドレス <span className="text-red-500">*</span></label>
                <Input
                  type="email"
                  placeholder="info@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="py-3"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1.5 block font-medium">電話番号 <span className="text-gray-400 font-normal">(任意)</span></label>
                <Input
                  type="tel"
                  placeholder="03-1234-5678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="py-3"
                />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Button
                onClick={handleStep1Next}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-5 text-base font-bold rounded-xl shadow-2xl shadow-purple-500/30 transition-all hover:scale-[1.02]"
              >
                次へ — 商品情報を入力 <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <button
                onClick={handleSkipSubmit}
                disabled={!formData.companyName || !formData.contactPerson || !formData.email || isSubmitting}
                className="w-full text-center text-sm text-purple-600 hover:text-purple-800 font-medium py-2 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "送信中..." : "商品情報は後で伝える（まず連絡だけ）"}
              </button>
            </div>

            <p className="text-center text-[11px] text-gray-400 mt-4">
              ※ 審査結果は3営業日以内にご連絡いたします
            </p>
          </div>
        ) : (
          /* Step 2: Product Details */
          <div className="p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 rounded-full px-4 py-1.5 text-xs font-bold mb-3">
                <CheckCircle2 className="h-3 w-3" />
                あと少しで完了
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">商品情報を教えてください</h2>
              <p className="text-sm text-gray-500">審査がスムーズに進みます（任意項目もあります）</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 mb-1.5 block font-medium">ブランド名 <span className="text-red-500">*</span></label>
                <Input
                  placeholder="ブランド名"
                  value={formData.brandName}
                  onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                  className="py-3"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1.5 block font-medium">商品URL <span className="text-gray-400 font-normal">(任意)</span></label>
                <Input
                  placeholder="https://example.com/product（なければ未入力でOK）"
                  value={formData.productUrl}
                  onChange={(e) => setFormData({ ...formData, productUrl: e.target.value })}
                  className="py-3"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1.5 block font-medium">商品の強み・特徴 <span className="text-red-500">*</span></label>
                <Textarea
                  placeholder="他社商品との差別化ポイント、ターゲット層、価格帯など"
                  rows={3}
                  value={formData.productStrength}
                  onChange={(e) => setFormData({ ...formData, productStrength: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1.5 block font-medium">過去の販売実績 <span className="text-gray-400 font-normal">(任意)</span></label>
                <Textarea
                  placeholder="EC売上、SNSフォロワー数、メディア掲載実績など"
                  rows={2}
                  value={formData.pastSalesRecord}
                  onChange={(e) => setFormData({ ...formData, pastSalesRecord: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.brandName || !formData.productStrength}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-5 text-base font-bold rounded-xl shadow-2xl shadow-purple-500/30 transition-all hover:scale-[1.02] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    送信中...
                  </div>
                ) : (
                  <>
                    無料審査に申し込む（{currentPlan?.name}） <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 text-center text-sm text-gray-500 hover:text-gray-700 font-medium py-2 transition-colors"
                >
                  ← 戻る
                </button>
                <button
                  onClick={handleSkipSubmit}
                  disabled={isSubmitting}
                  className="flex-1 text-center text-sm text-purple-600 hover:text-purple-800 font-medium py-2 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "送信中..." : "商品情報は後で伝える"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main LP Component
// ============================================================
export default function BrandSampleLP() {
  const [selectedPlan, setSelectedPlan] = useState<string>("algorithm");
  const [modalOpen, setModalOpen] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const openModal = (planId?: string) => {
    if (planId) setSelectedPlan(planId);
    setModalOpen(true);
  };

  const plans = [
    {
      id: "light",
      name: "ライト検証",
      samples: 30,
      price: "初期費用 0円",
      tagline: "まずはリスクゼロで検証",
      color: "bg-blue-50 text-blue-600",
      gradient: "linear-gradient(135deg, #3b82f6, #6366f1)",
      icon: <Target className="h-8 w-8 text-blue-600" />,
      features: [
        "TikTokクリエイター5〜10名にサンプル配布",
        "UGC（口コミ動画）5〜10本を生成",
        "初動の反応データをレポート提供",
        "最短2週間で結果が見える",
      ],
    },
    {
      id: "algorithm",
      name: "アルゴリズム攻略",
      samples: 50,
      price: "初期費用 0円",
      tagline: "TikTokの売上の柱を作る",
      color: "bg-purple-50 text-purple-600",
      gradient: "linear-gradient(135deg, #8b5cf6, #d946ef)",
      icon: <Zap className="h-8 w-8 text-purple-600" />,
      features: [
        "クリエイター15〜25名にサンプル配布",
        "ショート動画＋ライブ配信を組み合わせ",
        "TikTokアルゴリズムに「売れる商品」として認知",
        "月次パフォーマンスレポート付き",
        "専任コーディネーターがサポート",
      ],
    },
    {
      id: "market_jack",
      name: "市場ジャック",
      samples: 100,
      price: "初期費用 0円",
      tagline: "最速でランキング入りを狙う",
      color: "bg-amber-50 text-amber-600",
      gradient: "linear-gradient(135deg, #f59e0b, #ef4444)",
      icon: <Rocket className="h-8 w-8 text-amber-600" />,
      features: [
        "中堅〜トップ層ライバーも参加",
        "クリエイター30〜50名にサンプル配布",
        "大規模Live配信イベントを企画",
        "TikTokランキング入りを戦略的に狙う",
        "専属ディレクターが配信戦略を設計",
        "週次レポート＋戦略ミーティング",
      ],
    },
  ];

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-white">
      {/* Application Modal */}
      <ApplicationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        plan={selectedPlan}
        plans={plans}
      />

      {/* ============================================================ */}
      {/* HERO SECTION */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950 text-white">
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-purple-500/10 animate-pulse"
              style={{
                width: `${Math.random() * 200 + 50}px`,
                height: `${Math.random() * 200 + 50}px`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${Math.random() * 4 + 3}s`,
              }}
            />
          ))}
        </div>

        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-32">
          {/* LCJ Logo + Authority Badge */}
          <div className="flex items-center gap-4 mb-8">
            <img src={LCJ_LOGO_URL} alt="Live Commerce Japan" className="h-12 md:h-16 rounded-lg bg-white p-1.5" />
            <div className="bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/40 rounded-full px-4 py-2">
              <span className="text-amber-300 text-sm font-bold tracking-wide">日本最大級ライブコマース事務所</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Hero Text */}
            <div>
              <div className="mb-4">
                <UrgencyBadge />
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6">
                TikTok Shopの売上は
                <br />
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
                  UGCの数
                </span>
                で決まる
              </h1>
              <p className="text-lg text-gray-300 mb-8 leading-relaxed">
                初期費用0円。30個のサンプルが、貴社のTikTok売上を自動化する
                <strong className="text-white">最強のテストマーケティング</strong>になります。
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={() => openModal()}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-6 text-lg font-bold rounded-xl shadow-2xl shadow-purple-500/30 transition-all hover:scale-105"
                >
                  今すぐ無料審査に申し込む <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => document.getElementById("logic")?.scrollIntoView({ behavior: "smooth" })}
                  className="border-gray-600 text-gray-300 hover:bg-gray-800 px-8 py-6 text-lg rounded-xl bg-transparent"
                >
                  詳しく見る <ChevronDown className="ml-2 h-5 w-5" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                入力30秒・初期費用0円・審査無料
              </p>
            </div>

            {/* Hero Stats */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "累計UGC動画", value: 2400, suffix: "本+", icon: <Video className="h-6 w-6" />, color: "from-purple-500 to-pink-500" },
                { label: "提携ライバー", value: 350, suffix: "名+", icon: <Users className="h-6 w-6" />, color: "from-blue-500 to-cyan-500" },
                { label: "平均ROAS", value: 580, suffix: "%", icon: <TrendingUp className="h-6 w-6" />, color: "from-green-500 to-emerald-500" },
                { label: "ブランド導入実績", value: 85, suffix: "社+", icon: <Building2 className="h-6 w-6" />, color: "from-amber-500 to-orange-500" },
              ].map((stat, i) => (
                <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all">
                  <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} mb-3`}>
                    {stat.icon}
                  </div>
                  <div className="text-2xl md:text-3xl font-black">
                    <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Brand Results Ticker */}
          <div className="mt-12">
            <p className="text-center text-sm text-gray-500 mb-2">1時間ライブコマース売上実績</p>
            <BrandResultsTicker />
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,80 C360,120 720,40 1080,80 C1260,100 1380,60 1440,80 L1440,120 L0,120 Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ============================================================ */}
      {/* AUTHORITY BAR - 日本最大級の権威性 */}
      {/* ============================================================ */}
      <section className="py-10 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12">
            <img src={LCJ_LOGO_URL} alt="Live Commerce Japan" className="h-10 md:h-12 opacity-90" />
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 items-center">
              {[
                { label: "所属ライバー", value: "350名+" },
                { label: "累計配信時間", value: "50,000時間+" },
                { label: "取扱ブランド", value: "85社+" },
                { label: "月間視聴者数", value: "500万人+" },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <p className="text-xs text-gray-400">{stat.label}</p>
                  <p className="text-lg font-black text-gray-900">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 3-CHANNEL LOGIC */}
      {/* ============================================================ */}
      <section id="logic" className="py-20 md:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 rounded-full px-4 py-2 mb-4 text-sm font-medium">
              <BarChart3 className="h-4 w-4" />
              LCJの3チャネル戦略
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              なぜ<span className="text-purple-600">UGCの数</span>が
              売上を決めるのか？
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              TikTokアルゴリズムは「多くの人が紹介している商品」を自動的に拡散します。
              LCJは3つのチャネルで大量のUGCを生み出し、アルゴリズムを攻略します。
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Radio className="h-8 w-8" />,
                title: "ライブ配信で\n即時売上を生む",
                desc: "所属ライバーがリアルタイムで商品を紹介・販売。視聴者との双方向コミュニケーションで、1時間で数百万円の売上を生み出すことも。",
                stat: "1配信あたり平均視聴者 3,000人+",
                color: "from-red-500 to-pink-500",
                bgColor: "bg-red-50",
                highlight: "KYOGOKU 1時間で1億円+の売上実績",
              },
              {
                icon: <Video className="h-8 w-8" />,
                title: "UGC動画が\n一斉に投稿される",
                desc: "ライバーが実際に商品を使い、リアルな口コミ動画をTikTokに投稿。アルゴリズムが「売れる商品」と判定し、自動的にレコメンドに表示します。",
                stat: "1サンプルあたり平均1.5本の動画が生成",
                color: "from-purple-500 to-pink-500",
                bgColor: "bg-purple-50",
                highlight: "累計2,400本+のUGC動画を生成",
              },
              {
                icon: <Store className="h-8 w-8" />,
                title: "LCJ MALLで\n購入者レビュー蓄積",
                desc: "自社ECモール「LCJ MALL」で実際の購入者によるリアルレビューが蓄積。TikTok Shop上での信頼性を高め、コンバージョン率を向上させます。",
                stat: "購入者レビュー平均4.5以上",
                color: "from-emerald-500 to-teal-500",
                bgColor: "bg-emerald-50",
                highlight: "ECレビューがTikTok Shopの売上を後押し",
              },
            ].map((item, i) => (
              <div key={i} className={`relative rounded-2xl ${item.bgColor} p-8 hover:shadow-xl transition-all group overflow-hidden`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br opacity-10 rounded-bl-full" style={{ backgroundImage: `linear-gradient(135deg, var(--tw-gradient-stops))` }} />
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${item.color} text-white mb-5 group-hover:scale-110 transition-transform`}>
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 whitespace-pre-line">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-4">{item.desc}</p>
                <div className="bg-white rounded-lg px-4 py-2 border border-gray-200 mb-3">
                  <p className="text-xs text-purple-600 font-medium">{item.stat}</p>
                </div>
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg px-4 py-2">
                  <p className="text-xs text-amber-700 font-bold flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                    {item.highlight}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA after 3-channel */}
          <InlineCTA onClick={() => openModal()} text="3チャネル戦略を試してみる" />
        </div>
      </section>

      {/* ============================================================ */}
      {/* 5-STEP FLOW - サンプルから売上までの流れ */}
      {/* ============================================================ */}
      <section className="py-20 md:py-28 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 rounded-full px-4 py-2 mb-4 text-sm font-medium">
              <Rocket className="h-4 w-4" />
              サンプルから売上が生まれるまで
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              <span className="text-purple-600">5つのSTEP</span>で
              売上が自動化される
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              サンプルを送るだけ。あとはLCJの仕組みが自動的に売上を生み出します。
            </p>
          </div>

          {/* STEP 1 */}
          <div className="relative">
            {/* Vertical line connector */}
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-300 via-purple-400 to-amber-400 hidden md:block" style={{ transform: "translateX(-50%)" }} />

            {/* STEP 1: サンプル配布 */}
            <div className="relative mb-16 md:mb-24">
              <div className="md:grid md:grid-cols-2 md:gap-12 items-center">
                <div className="md:text-right mb-6 md:mb-0">
                  <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 rounded-full px-4 py-1.5 text-xs font-bold mb-4">
                    STEP 1
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-3">サンプルをライバーに配布</h3>
                  <p className="text-gray-500 leading-relaxed">
                    LCJが厳選した実績あるTikTokライバーに、貴社の商品サンプルを配布。
                    <strong className="text-gray-900">350名以上</strong>の所属ライバーの中から、
                    商品カテゴリに最適なライバーを選定します。
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 bg-blue-50 rounded-lg px-4 py-2">
                    <Send className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-700 font-medium">30〜100個のサンプルを5〜50名に配布</span>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute -left-4 md:left-0 top-1/2 -translate-y-1/2 md:-translate-x-1/2 w-8 h-8 bg-blue-500 rounded-full border-4 border-white shadow-lg z-10 hidden md:flex items-center justify-center">
                    <span className="text-white text-xs font-bold">1</span>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 ml-0 md:ml-8">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white">
                        <Users className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">LCJ所属ライバー</p>
                        <p className="text-2xl font-black text-gray-900">350名+</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {["美容系", "食品系", "ガジェット", "ファッション", "健康系", "ライフスタイル"].map((cat, i) => (
                        <div key={i} className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                          <p className="text-xs text-gray-600 font-medium">{cat}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 2: ライブ配信 */}
            <div className="relative mb-16 md:mb-24">
              <div className="md:grid md:grid-cols-2 md:gap-12 items-center">
                <div className="order-2 md:order-1 relative">
                  <div className="absolute -left-4 md:right-0 top-1/2 -translate-y-1/2 md:translate-x-1/2 w-8 h-8 bg-red-500 rounded-full border-4 border-white shadow-lg z-10 hidden md:flex items-center justify-center">
                    <span className="text-white text-xs font-bold">2</span>
                  </div>
                  <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl p-6 shadow-lg border border-red-100 mr-0 md:mr-8">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-xs font-bold text-red-600">LIVE配信中</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Eye className="h-3 w-3" />
                        3,247人が視聴中
                      </div>
                    </div>
                    {/* Brand result highlight */}
                    <div className="bg-white rounded-xl p-4 border border-red-100 mb-3">
                      <p className="text-xs text-gray-400 mb-1">1時間ライブコマース売上実績</p>
                      <div className="space-y-2">
                        {BRAND_RESULTS.slice(0, 3).map((b, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded bg-gradient-to-br ${b.color} flex items-center justify-center text-white text-[10px] font-bold`}>
                                {b.name.charAt(0)}
                              </div>
                              <span className="text-sm text-gray-700 font-medium">{b.name}</span>
                            </div>
                            <span className="text-sm font-black text-red-600">{b.amount}+</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-400" />
                      <span className="text-xs text-gray-500">リアルタイムで購買意欲を直接刺激</span>
                    </div>
                  </div>
                </div>
                <div className="order-1 md:order-2 mb-6 md:mb-0">
                  <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 rounded-full px-4 py-1.5 text-xs font-bold mb-4">
                    STEP 2
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-3">ライブ配信でリアルタイム紹介</h3>
                  <p className="text-gray-500 leading-relaxed">
                    所属ライバーがライブ配信中に貴社商品をリアルタイムで紹介・販売。
                    視聴者との双方向コミュニケーションで、
                    <strong className="text-gray-900">1時間で数百万円の売上</strong>を生み出すことも。
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 bg-red-50 rounded-lg px-4 py-2">
                    <Radio className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-red-700 font-medium">KYOGOKU 1時間で1億円+の売上実績</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA between Step 2 and ROI */}
            <InlineCTA onClick={() => openModal()} text="この実績を貴社でも実現する" variant="secondary" />

            {/* ROI Data Mix - Between Step 2 and 3 */}
            <div className="relative mb-16 md:mb-24">
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl p-8 md:p-12 border border-purple-100 max-w-4xl mx-auto">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <img src={LCJ_LOGO_URL} alt="LCJ" className="h-8 rounded" />
                      <span className="text-xs text-purple-600 font-bold bg-purple-100 px-3 py-1 rounded-full">投資対効果</span>
                    </div>
                    <h3 className="text-2xl font-black text-gray-900 mb-4">
                      サンプル50個の投資対効果
                    </h3>
                    <p className="text-gray-600 mb-6">
                      仮に商品原価が1個500円の場合、50個で25,000円の投資。
                      これが平均ROAS 580%で回ると…
                    </p>
                    <div className="space-y-4">
                      {[
                        { label: "サンプル原価", value: "¥25,000", sub: "50個 × ¥500" },
                        { label: "生成されるUGC動画", value: "約75本", sub: "1サンプル平均1.5本" },
                        { label: "想定売上（3ヶ月）", value: "¥145,000", sub: "ROAS 580%", highlight: true },
                      ].map((row, i) => (
                        <div key={i} className={`flex justify-between items-center p-4 rounded-xl ${row.highlight ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white" : "bg-white"}`}>
                          <div>
                            <p className={`text-sm ${row.highlight ? "text-white/80" : "text-gray-500"}`}>{row.label}</p>
                            <p className={`text-xs ${row.highlight ? "text-white/60" : "text-gray-400"}`}>{row.sub}</p>
                          </div>
                          <p className={`text-xl font-black ${row.highlight ? "text-white" : "text-gray-900"}`}>{row.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="bg-white rounded-2xl p-8 shadow-xl border border-purple-100">
                      <p className="text-sm text-gray-500 mb-2">投資回収率</p>
                      <div className="text-7xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                        <AnimatedCounter end={580} suffix="%" />
                      </div>
                      <p className="text-sm text-gray-400">平均ROAS</p>
                      <div className="mt-6 pt-6 border-t border-gray-100">
                        <p className="text-sm text-gray-500">つまり、<strong className="text-gray-900">25,000円の投資</strong>が</p>
                        <p className="text-2xl font-black text-green-600 mt-1">+¥120,000の利益</p>
                        <p className="text-xs text-gray-400 mt-1">に変わります</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 3: UGC動画 */}
            <div className="relative mb-16 md:mb-24">
              <div className="md:grid md:grid-cols-2 md:gap-12 items-center">
                <div className="md:text-right mb-6 md:mb-0">
                  <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 rounded-full px-4 py-1.5 text-xs font-bold mb-4">
                    STEP 3
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-3">UGC動画が一斉に投稿される</h3>
                  <p className="text-gray-500 leading-relaxed">
                    ライバーが実際に商品を使い、リアルな口コミ動画をTikTokに投稿。
                    <strong className="text-gray-900">累計2,400本以上</strong>のUGC動画を生成してきた実績があります。
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 bg-purple-50 rounded-lg px-4 py-2">
                    <Video className="h-4 w-4 text-purple-600" />
                    <span className="text-sm text-purple-700 font-medium">1サンプルあたり平均1.5本の動画が生成</span>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute -left-4 md:left-0 top-1/2 -translate-y-1/2 md:-translate-x-1/2 w-8 h-8 bg-purple-500 rounded-full border-4 border-white shadow-lg z-10 hidden md:flex items-center justify-center">
                    <span className="text-white text-xs font-bold">3</span>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 ml-0 md:ml-8">
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[
                        { platform: "TikTok", icon: "🎵", count: "1,800+" },
                        { platform: "Instagram", icon: "📸", count: "400+" },
                        { platform: "YouTube", icon: "▶️", count: "200+" },
                      ].map((p, i) => (
                        <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
                          <span className="text-2xl">{p.icon}</span>
                          <p className="text-xs text-gray-500 mt-1">{p.platform}</p>
                          <p className="text-sm font-black text-gray-900">{p.count}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <p className="text-xs text-purple-700 font-medium text-center">
                        累計 <span className="text-lg font-black">2,400本+</span> のUGC動画を生成
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 4: LCJ MALLレビュー */}
            <div className="relative mb-16 md:mb-24">
              <div className="md:grid md:grid-cols-2 md:gap-12 items-center">
                <div className="order-2 md:order-1 relative">
                  <div className="absolute -left-4 md:right-0 top-1/2 -translate-y-1/2 md:translate-x-1/2 w-8 h-8 bg-emerald-500 rounded-full border-4 border-white shadow-lg z-10 hidden md:flex items-center justify-center">
                    <span className="text-white text-xs font-bold">4</span>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 shadow-lg border border-emerald-100 mr-0 md:mr-8">
                    <div className="flex items-center gap-2 mb-4">
                      <Store className="h-5 w-5 text-emerald-600" />
                      <span className="text-sm font-bold text-emerald-700">LCJ MALL</span>
                    </div>
                    <div className="space-y-3 mb-4">
                      {[
                        { stars: 5, text: "ライブで見て即購入！使い心地最高です", name: "M.T さん" },
                        { stars: 5, text: "動画で紹介されてた通り、肌がもちもちに", name: "K.S さん" },
                        { stars: 4, text: "コスパ良し。リピート確定です！", name: "A.Y さん" },
                      ].map((review, i) => (
                        <div key={i} className="bg-white rounded-lg p-3 border border-emerald-100">
                          <div className="flex items-center gap-1 mb-1">
                            {Array.from({ length: review.stars }).map((_, j) => (
                              <Star key={j} className="h-3 w-3 fill-amber-400 text-amber-400" />
                            ))}
                          </div>
                          <p className="text-xs text-gray-600">{review.text}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{review.name}</p>
                        </div>
                      ))}
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-emerald-600 font-medium">購入者レビュー平均 <span className="text-lg font-black">4.5</span> / 5.0</p>
                    </div>
                  </div>
                </div>
                <div className="order-1 md:order-2 mb-6 md:mb-0">
                  <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 rounded-full px-4 py-1.5 text-xs font-bold mb-4">
                    STEP 4
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-3">LCJ MALLで購入者レビュー蓄積</h3>
                  <p className="text-gray-500 leading-relaxed">
                    自社ECモール「LCJ MALL」で実際の購入者によるリアルレビューが蓄積。
                    ライブ配信やUGC動画を見た視聴者が購入し、
                    <strong className="text-gray-900">信頼性の高い口コミ</strong>がさらに新規顧客を呼び込みます。
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 bg-emerald-50 rounded-lg px-4 py-2">
                    <MessageSquare className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm text-emerald-700 font-medium">ECレビューがTikTok Shopの売上を後押し</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Brand Results Mix - Between Step 4 and 5 */}
            <div className="relative mb-16 md:mb-24">
              <div className="bg-gradient-to-br from-gray-950 via-red-950 to-gray-950 rounded-3xl p-8 md:p-12 max-w-4xl mx-auto overflow-hidden relative">
                <div className="absolute inset-0 overflow-hidden">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="absolute rounded-full bg-red-500/5 animate-pulse" style={{
                      width: `${Math.random() * 150 + 50}px`, height: `${Math.random() * 150 + 50}px`,
                      left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
                      animationDelay: `${Math.random() * 3}s`,
                    }} />
                  ))}
                </div>
                <div className="relative">
                  <div className="flex items-center gap-3 mb-6">
                    <img src={LCJ_LOGO_URL} alt="LCJ" className="h-8 rounded bg-white p-1" />
                    <span className="text-amber-400 text-sm font-bold">1時間ライブコマース売上実績</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {BRAND_RESULTS.map((brand, i) => (
                      <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all group">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${brand.color} flex items-center justify-center text-white font-black text-sm mb-3 group-hover:scale-110 transition-transform`}>
                          {brand.name.charAt(0)}
                        </div>
                        <p className="text-white/70 text-xs font-medium mb-1">{brand.name}</p>
                        <p className="text-white font-black text-xl">{brand.amount}<span className="text-white/50 text-xs">+</span></p>
                      </div>
                    ))}
                  </div>
                  <p className="text-center text-gray-500 text-xs mt-6">※ 各ブランドの1時間あたりのライブコマース売上実績</p>
                  {/* CTA inside brand results */}
                  <div className="text-center mt-8">
                    <Button
                      onClick={() => openModal()}
                      className="bg-white text-gray-900 hover:bg-gray-100 px-10 py-5 text-base font-bold rounded-xl shadow-2xl transition-all hover:scale-105"
                    >
                      次はあなたのブランドの番です <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 5: アルゴリズム拡散 */}
            <div className="relative">
              <div className="md:grid md:grid-cols-2 md:gap-12 items-center">
                <div className="md:text-right mb-6 md:mb-0">
                  <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 rounded-full px-4 py-1.5 text-xs font-bold mb-4">
                    STEP 5
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-3">アルゴリズムが自動拡散</h3>
                  <p className="text-gray-500 leading-relaxed">
                    ライブ配信・UGC動画・購入者レビューの3チャネルからの信号が集まると、
                    TikTokが<strong className="text-gray-900">「売れる商品」</strong>と判定。
                    自動的にレコメンドに表示され、売上が加速度的に伸びます。
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 bg-amber-50 rounded-lg px-4 py-2">
                    <TrendingUp className="h-4 w-4 text-amber-600" />
                    <span className="text-sm text-amber-700 font-medium">平均ROAS 580%を達成</span>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute -left-4 md:left-0 top-1/2 -translate-y-1/2 md:-translate-x-1/2 w-8 h-8 bg-amber-500 rounded-full border-4 border-white shadow-lg z-10 hidden md:flex items-center justify-center">
                    <span className="text-white text-xs font-bold">5</span>
                  </div>
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 shadow-lg border border-amber-100 ml-0 md:ml-8">
                    <div className="text-center mb-4">
                      <p className="text-xs text-gray-400 mb-1">3チャネルの相乗効果</p>
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <div className="bg-red-100 rounded-lg p-2"><Radio className="h-4 w-4 text-red-600" /></div>
                        <span className="text-gray-300">+</span>
                        <div className="bg-purple-100 rounded-lg p-2"><Video className="h-4 w-4 text-purple-600" /></div>
                        <span className="text-gray-300">+</span>
                        <div className="bg-emerald-100 rounded-lg p-2"><Store className="h-4 w-4 text-emerald-600" /></div>
                        <span className="text-gray-300">=</span>
                        <div className="bg-amber-100 rounded-lg p-2"><Rocket className="h-4 w-4 text-amber-600" /></div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-amber-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">TikTokアルゴリズム評価</span>
                        <span className="text-xs font-bold text-green-600">売れる商品と認定</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 h-full rounded-full animate-pulse" style={{ width: "92%" }} />
                      </div>
                      <p className="text-right text-xs text-amber-600 font-bold mt-1">92%</p>
                    </div>
                    <p className="text-center text-xs text-gray-500 mt-3">自動レコメンドで新規顧客が流入し続ける</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* WHY AUDIT SYSTEM */}
      {/* ============================================================ */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 rounded-full px-4 py-2 mb-4 text-sm font-medium">
              <Shield className="h-4 w-4" />
              なぜ審査制なのか
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              「選ばれたブランド」だけが
              <span className="text-amber-600">結果を出せる</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Award className="h-7 w-7" />,
                title: "クリエイターの信頼を守る",
                desc: "売れない商品を紹介させると、クリエイターのフォロワーが離れます。審査で「TikTokで売れる商品」だけを厳選します。",
                color: "bg-amber-50 text-amber-600",
              },
              {
                icon: <TrendingUp className="h-7 w-7" />,
                title: "成功事例を積み上げる",
                desc: "審査を通過した商品は高確率で売れるため、成功事例が増え、さらに優秀なクリエイターが集まる好循環が生まれます。",
                color: "bg-green-50 text-green-600",
              },
              {
                icon: <Star className="h-7 w-7" />,
                title: "ブランド価値を高める",
                desc: "「LCJ審査通過」はTikTok市場での信頼の証。通過したブランドはクリエイターから優先的に選ばれます。",
                color: "bg-purple-50 text-purple-600",
              },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-all">
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl ${item.color} mb-5`}>
                  {item.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* CTA after audit section */}
          <InlineCTA onClick={() => openModal()} text="審査通過率30% — 今すぐ挑戦する" />
        </div>
      </section>

      {/* ============================================================ */}
      {/* PLAN COMPARISON - 松竹梅 */}
      {/* ============================================================ */}
      <section className="py-20 md:py-28 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-pink-50 text-pink-700 rounded-full px-4 py-2 mb-4 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              プラン比較
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              貴社に最適なプランを
              <span className="text-purple-600">お選びください</span>
            </h2>
            <p className="text-gray-500">すべてのプランで初期費用0円。サンプル提供のみでスタートできます。</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isPopular={plan.id === "algorithm"}
                onSelect={() => openModal(plan.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* PROCESS STEPS - 申込の流れ */}
      {/* ============================================================ */}
      <section className="py-20 bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950 text-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              申込から売上発生まで
              <span className="text-purple-400">たった3ステップ</span>
            </h2>
            <p className="text-gray-400">面倒な手続きは一切なし。サンプルを送るだけで始められます。</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "無料審査に申し込む",
                desc: "ポップアップフォームから基本情報を入力。たった30秒で完了します。",
                icon: <FileText className="h-8 w-8" />,
                time: "所要時間: 30秒",
              },
              {
                step: "02",
                title: "サンプルを送付",
                desc: "審査通過後、LCJ倉庫宛にサンプルを送付。TikTok Seller Centerでアフィリエイトリンクを発行。",
                icon: <ShoppingCart className="h-8 w-8" />,
                time: "所要時間: 1〜3日",
              },
              {
                step: "03",
                title: "3チャネルで売上が自動発生",
                desc: "ライブ配信・UGC動画・LCJ MALLレビューの3チャネルで売上が自動的に発生します。",
                icon: <TrendingUp className="h-8 w-8" />,
                time: "最短2週間で結果",
              },
            ].map((item, i) => (
              <div key={i} className="relative">
                {i < 2 && (
                  <div className="hidden md:block absolute top-12 -right-4 z-10">
                    <ArrowRight className="h-8 w-8 text-purple-500/50" />
                  </div>
                )}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 h-full hover:bg-white/10 transition-all">
                  <div className="text-5xl font-black text-purple-500/30 mb-4">{item.step}</div>
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-purple-500/20 text-purple-400 mb-5">
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-4">{item.desc}</p>
                  <div className="flex items-center gap-2 text-xs text-purple-400">
                    <Clock className="h-3 w-3" />
                    {item.time}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA in dark section */}
          <div className="text-center mt-12">
            <Button
              onClick={() => openModal()}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-10 py-6 text-lg font-bold rounded-xl shadow-2xl shadow-purple-500/30 transition-all hover:scale-105"
            >
              30秒で無料審査に申し込む <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* FAQ */}
      {/* ============================================================ */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-black text-center text-gray-900 mb-12">よくある質問</h2>
          <div className="space-y-4">
            {[
              {
                q: "本当に初期費用0円ですか？",
                a: "はい、初期費用・月額費用は一切かかりません。必要なのはサンプル商品の提供のみです。売上が発生した場合のみ、TikTok Shopのアフィリエイト報酬（20%）がクリエイターに支払われます。",
              },
              {
                q: "審査基準は何ですか？",
                a: "TikTokで「売れる可能性が高い商品」かどうかを総合的に判断します。具体的には、商品の独自性、ビジュアルの訴求力、価格帯、ターゲット層とTikTokユーザーの親和性などを評価します。",
              },
              {
                q: "サンプルはどこに送ればいいですか？",
                a: "審査通過後に、LCJ専用倉庫の住所をお知らせします。サンプルが届き次第、クリエイターへの配布を開始します。",
              },
              {
                q: "どのくらいで結果が出ますか？",
                a: "サンプル到着後、最短2週間でUGC動画の投稿が始まります。売上の本格的な発生は1〜2ヶ月後が目安です。アルゴリズム攻略プラン以上では、より早い結果が期待できます。",
              },
              {
                q: "審査に落ちた場合、再申込はできますか？",
                a: "はい、可能です。審査結果のフィードバックをもとに商品を改善いただいた上で、再度お申し込みいただけます。",
              },
              {
                q: "ライブ配信とUGC動画の違いは？",
                a: "ライブ配信はリアルタイムで視聴者と対話しながら商品を紹介・販売する形式で、即時の売上が期待できます。UGC動画はTikTokに投稿される短尺の口コミ動画で、アルゴリズムによる長期的な拡散効果があります。LCJでは両方を組み合わせることで最大の効果を発揮します。",
              },
            ].map((faq, i) => (
              <details key={i} className="group bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                <summary className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-100 transition-colors">
                  <span className="font-medium text-gray-900">{faq.q}</span>
                  <ChevronDown className="h-5 w-5 text-gray-400 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-5 pb-5 text-sm text-gray-600 leading-relaxed">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* FINAL CTA */}
      {/* ============================================================ */}
      <section className="py-20 bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950 text-white text-center">
        <div className="max-w-3xl mx-auto px-4">
          <img src={LCJ_LOGO_URL} alt="Live Commerce Japan" className="h-12 mx-auto mb-6 rounded-lg bg-white p-1.5" />
          <p className="text-amber-400 text-sm font-bold mb-4">日本最大級ライブコマース事務所</p>
          <div className="mb-6">
            <UrgencyBadge />
          </div>
          <h2 className="text-3xl md:text-4xl font-black mb-6">
            30個のサンプルが、
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              TikTok売上を自動化する
            </span>
          </h2>
          <p className="text-gray-400 mb-8">
            毎月限定20ブランド。審査通過率30%。
            <br />
            今すぐ申し込んで、TikTok Shopの売上を手に入れましょう。
          </p>
          <Button
            onClick={() => openModal()}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-10 py-6 text-lg font-bold rounded-xl shadow-2xl shadow-purple-500/30 transition-all hover:scale-105"
          >
            今すぐ無料審査に申し込む <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="text-xs text-gray-500 mt-3 flex items-center justify-center gap-1">
            <Clock className="h-3 w-3" />
            入力30秒・初期費用0円・審査無料
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-gray-950 text-center">
        <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} Live Commerce Japan. All rights reserved.</p>
      </footer>
    </div>
  );
}
