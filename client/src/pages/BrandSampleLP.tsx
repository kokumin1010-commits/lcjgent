import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Rocket, TrendingUp, Users, Video, CheckCircle2, ArrowRight,
  Zap, Shield, BarChart3, Star, ChevronDown, Play, Target,
  Award, Clock, Eye, ShoppingCart, Sparkles, ChevronRight,
  Building2, Mail, Phone, Globe, FileText, Send
} from "lucide-react";

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
// Plan Card Component
// ============================================================
function PlanCard({ plan, isPopular, selected, onSelect }: {
  plan: { id: string; name: string; samples: number; price: string; features: string[]; color: string; gradient: string; icon: React.ReactNode; tagline: string };
  isPopular: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`relative rounded-2xl border-2 p-6 cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
        selected
          ? `border-transparent ring-4 ring-purple-400/50 shadow-2xl shadow-purple-500/20`
          : isPopular
          ? "border-purple-300 shadow-xl shadow-purple-500/10"
          : "border-gray-200 shadow-md hover:shadow-lg"
      }`}
      style={{ background: selected ? plan.gradient : "white" }}
    >
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold px-6 py-1.5 rounded-full shadow-lg animate-pulse">
          一番人気
        </div>
      )}
      <div className="text-center">
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 ${selected ? "bg-white/20" : plan.color}`}>
          {plan.icon}
        </div>
        <h3 className={`text-xl font-bold mb-1 ${selected ? "text-white" : "text-gray-900"}`}>{plan.name}</h3>
        <p className={`text-sm mb-4 ${selected ? "text-white/80" : "text-gray-500"}`}>{plan.tagline}</p>
        <div className={`text-5xl font-black mb-1 ${selected ? "text-white" : "text-gray-900"}`}>
          {plan.samples}<span className="text-lg font-medium">個</span>
        </div>
        <p className={`text-sm mb-6 ${selected ? "text-white/70" : "text-gray-400"}`}>{plan.price}</p>
        <ul className="space-y-3 text-left mb-6">
          {plan.features.map((f, i) => (
            <li key={i} className={`flex items-start gap-2 text-sm ${selected ? "text-white/90" : "text-gray-600"}`}>
              <CheckCircle2 className={`h-4 w-4 mt-0.5 shrink-0 ${selected ? "text-white" : "text-green-500"}`} />
              {f}
            </li>
          ))}
        </ul>
        <Button
          className={`w-full py-3 text-base font-bold rounded-xl transition-all ${
            selected
              ? "bg-white text-purple-700 hover:bg-white/90 shadow-lg"
              : isPopular
              ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-lg"
              : "bg-gray-900 text-white hover:bg-gray-800"
          }`}
        >
          {selected ? "選択中" : "このプランを選ぶ"}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Main LP Component
// ============================================================
export default function BrandSampleLP() {
  const [selectedPlan, setSelectedPlan] = useState<string>("algorithm");
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
  const formRef = useRef<HTMLDivElement>(null);

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
        "ショート動画＋小規模Live配信を組み合わせ",
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

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = () => {
    if (!formData.companyName || !formData.contactPerson || !formData.email || !formData.brandName || !formData.productUrl || !formData.productStrength) {
      toast.error("必須項目をすべて入力してください");
      return;
    }
    setIsSubmitting(true);
    const plan = plans.find((p) => p.id === selectedPlan)!;
    submitMutation.mutate({
      ...formData,
      plan: selectedPlan as "light" | "algorithm" | "market_jack",
      sampleCount: plan.samples,
    });
  };

  // ============================================================
  // RENDER
  // ============================================================
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
        <div className="max-w-lg text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-green-500/30 animate-bounce">
            <CheckCircle2 className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-4">審査申込を受け付けました</h1>
          <p className="text-gray-600 mb-2">3営業日以内に審査結果をメールにてご連絡いたします。</p>
          <p className="text-sm text-gray-400 mb-8">※ 毎月限定20ブランドのみ受付のため、審査通過率は約30%です。</p>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-3">審査通過後の流れ</h3>
            <div className="space-y-3 text-left">
              {[
                "LCJ倉庫宛にサンプルをご送付",
                "TikTok Seller Centerでアフィリエイトリンク（報酬20%）を発行",
                "ライバーへの配布・動画投稿を開始",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold shrink-0">{i + 1}</div>
                  <p className="text-sm text-gray-600 pt-0.5">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
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
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-purple-500/20 border border-purple-500/30 rounded-full px-4 py-2 mb-6">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-purple-300 font-medium">毎月限定20ブランド ・ 審査通過率30%</span>
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
                  onClick={scrollToForm}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-6 text-lg font-bold rounded-xl shadow-2xl shadow-purple-500/30 transition-all hover:scale-105"
                >
                  無料審査に申し込む <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => document.getElementById("logic")?.scrollIntoView({ behavior: "smooth" })}
                  className="border-gray-600 text-gray-300 hover:bg-gray-800 px-8 py-6 text-lg rounded-xl bg-transparent"
                >
                  詳しく見る <ChevronDown className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Hero Stats */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "累計UGC動画", value: 2400, suffix: "本+", icon: <Video className="h-6 w-6" />, color: "from-purple-500 to-pink-500" },
                { label: "提携クリエイター", value: 350, suffix: "名+", icon: <Users className="h-6 w-6" />, color: "from-blue-500 to-cyan-500" },
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
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,80 C360,120 720,40 1080,80 C1260,100 1380,60 1440,80 L1440,120 L0,120 Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SOCIAL PROOF BAR */}
      {/* ============================================================ */}
      <section className="py-8 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-center text-sm text-gray-400 mb-4">導入ブランド実績</p>
          <div className="flex flex-wrap justify-center gap-8 items-center opacity-50">
            {["コスメブランドA", "サプリメントB", "スキンケアC", "ヘアケアD", "フードE"].map((brand, i) => (
              <div key={i} className="text-gray-400 font-bold text-lg tracking-wider">{brand}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* LOGIC EDUCATION - なぜUGCが重要なのか */}
      {/* ============================================================ */}
      <section id="logic" className="py-20 md:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 rounded-full px-4 py-2 mb-4 text-sm font-medium">
              <BarChart3 className="h-4 w-4" />
              なぜ30個のサンプルで売上が変わるのか
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              TikTokのアルゴリズムは
              <span className="text-purple-600">「UGCの量」</span>
              で売れる商品を判定する
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              フォロワー数ゼロのアカウントでも、UGC動画が増えれば
              TikTokが自動的に「売れる商品」として拡散してくれます。
            </p>
          </div>

          {/* 3-Step Logic */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {[
              {
                step: "STEP 1",
                title: "サンプルをライバーに配布",
                desc: "LCJが厳選した実績あるTikTokクリエイターに、貴社の商品サンプルを配布します。",
                icon: <Send className="h-8 w-8" />,
                color: "from-blue-500 to-cyan-500",
                detail: "30〜100個のサンプルを5〜50名のクリエイターに配布",
              },
              {
                step: "STEP 2",
                title: "UGC動画が一斉に投稿される",
                desc: "クリエイターが実際に商品を使い、リアルな口コミ動画をTikTokに投稿します。",
                icon: <Video className="h-8 w-8" />,
                color: "from-purple-500 to-pink-500",
                detail: "1サンプルあたり平均1.5本の動画が生成",
              },
              {
                step: "STEP 3",
                title: "アルゴリズムが自動拡散",
                desc: "UGC動画の数が一定を超えると、TikTokが「売れる商品」と判定し、自動的にレコメンドに表示します。",
                icon: <Rocket className="h-8 w-8" />,
                color: "from-amber-500 to-red-500",
                detail: "平均ROAS 580%を達成",
              },
            ].map((item, i) => (
              <div key={i} className="relative">
                {i < 2 && (
                  <div className="hidden md:block absolute top-16 -right-4 z-10">
                    <ChevronRight className="h-8 w-8 text-gray-300" />
                  </div>
                )}
                <div className="bg-gray-50 rounded-2xl p-8 h-full hover:shadow-lg transition-all group">
                  <div className="text-xs font-bold text-purple-600 mb-4 tracking-wider">{item.step}</div>
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${item.color} text-white mb-5 group-hover:scale-110 transition-transform`}>
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-4">{item.desc}</p>
                  <div className="bg-white rounded-lg px-4 py-2 border border-gray-200">
                    <p className="text-xs text-purple-600 font-medium">{item.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ROI Calculator */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl p-8 md:p-12 border border-purple-100">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
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
      </section>

      {/* ============================================================ */}
      {/* WHY AUDIT SYSTEM */}
      {/* ============================================================ */}
      <section className="py-20 bg-gray-50">
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
        </div>
      </section>

      {/* ============================================================ */}
      {/* PLAN COMPARISON - 松竹梅 */}
      {/* ============================================================ */}
      <section className="py-20 md:py-28 bg-white">
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
                selected={selectedPlan === plan.id}
                onSelect={() => setSelectedPlan(plan.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* PROCESS STEPS */}
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
                desc: "下のフォームから商品情報を入力。3営業日以内に審査結果をお知らせします。",
                icon: <FileText className="h-8 w-8" />,
                time: "所要時間: 3分",
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
                title: "UGC動画＆売上が自動発生",
                desc: "クリエイターが動画を投稿。TikTokアルゴリズムが拡散し、売上が自動的に発生します。",
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
        </div>
      </section>

      {/* ============================================================ */}
      {/* APPLICATION FORM */}
      {/* ============================================================ */}
      <section ref={formRef} className="py-20 md:py-28 bg-gradient-to-br from-purple-50 via-white to-pink-50">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 rounded-full px-4 py-2 mb-4 text-sm font-medium animate-pulse">
              <Zap className="h-4 w-4" />
              毎月限定20ブランド ・ 残り枠わずか
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              今すぐ無料審査に申し込む
            </h2>
            <p className="text-gray-500">
              選択中のプラン: <strong className="text-purple-600">{plans.find((p) => p.id === selectedPlan)?.name}</strong>
              （サンプル{plans.find((p) => p.id === selectedPlan)?.samples}個）
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl shadow-purple-500/10 border border-gray-100 p-8 md:p-10">
            {/* Plan selector mini */}
            <div className="flex gap-2 mb-8 p-1 bg-gray-100 rounded-xl">
              {plans.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlan(p.id)}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                    selectedPlan === p.id
                      ? "bg-white text-purple-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <div className="space-y-6">
              {/* Company Info */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-purple-600" />
                  会社情報
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600 mb-1.5 block">会社名 <span className="text-red-500">*</span></label>
                    <Input
                      placeholder="株式会社〇〇"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 mb-1.5 block">ご担当者名 <span className="text-red-500">*</span></label>
                    <Input
                      placeholder="山田 太郎"
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 mb-1.5 block">メールアドレス <span className="text-red-500">*</span></label>
                    <Input
                      type="email"
                      placeholder="info@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 mb-1.5 block">電話番号</label>
                    <Input
                      type="tel"
                      placeholder="03-1234-5678"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Product Info */}
              <div className="pt-4 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-purple-600" />
                  商品情報
                </h3>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600 mb-1.5 block">ブランド名 <span className="text-red-500">*</span></label>
                      <Input
                        placeholder="ブランド名"
                        value={formData.brandName}
                        onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 mb-1.5 block">商品URL <span className="text-red-500">*</span></label>
                      <Input
                        type="url"
                        placeholder="https://example.com/product"
                        value={formData.productUrl}
                        onChange={(e) => setFormData({ ...formData, productUrl: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 mb-1.5 block">商品の強み・特徴 <span className="text-red-500">*</span></label>
                    <Textarea
                      placeholder="他社商品との差別化ポイント、ターゲット層、価格帯など"
                      rows={3}
                      value={formData.productStrength}
                      onChange={(e) => setFormData({ ...formData, productStrength: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 mb-1.5 block">過去の販売実績（任意）</label>
                    <Textarea
                      placeholder="EC売上、SNSフォロワー数、メディア掲載実績など"
                      rows={2}
                      value={formData.pastSalesRecord}
                      onChange={(e) => setFormData({ ...formData, pastSalesRecord: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="pt-6">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 text-lg font-bold rounded-xl shadow-2xl shadow-purple-500/30 transition-all hover:scale-[1.02] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      送信中...
                    </div>
                  ) : (
                    <>
                      無料審査に申し込む（{plans.find((p) => p.id === selectedPlan)?.name}）
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
                <p className="text-center text-xs text-gray-400 mt-4">
                  ※ 審査結果は3営業日以内にメールにてご連絡いたします。
                  <br />
                  ※ 審査通過率は約30%です。商品の品質・市場性を総合的に判断します。
                </p>
              </div>
            </div>
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
            onClick={scrollToForm}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-10 py-6 text-lg font-bold rounded-xl shadow-2xl shadow-purple-500/30 transition-all hover:scale-105"
          >
            無料審査に申し込む <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-gray-950 text-center">
        <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} LCJ. All rights reserved.</p>
      </footer>
    </div>
  );
}
