import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Calculator,
  DollarSign,
  TrendingUp,
  Users,
  Clock,
  Zap,
  Share2,
  Copy,
  Check,
  Brain,
  BarChart3,
  Package,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Plus,
  Trash2,
  Tag,
  Percent,
  Eye,
  Megaphone,
  Trophy,
  MapPin,
  ThumbsUp,
  MessageCircle,
  Monitor,
  Target,
  Banknote,
  ShoppingCart,
  Star,
} from "lucide-react";
import { toast } from "sonner";

// Matrix rain effect
function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const chars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノ¥$%";
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = Array(columns).fill(1);
    const draw = () => {
      ctx.fillStyle = "rgba(10, 25, 47, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(0, 255, 200, 0.15)";
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };
    const interval = setInterval(draw, 50);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-30" />;
}

function formatCurrency(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : Number(value);
  if (isNaN(num)) return "¥0";
  return `¥${num.toLocaleString("ja-JP")}`;
}

export default function Simulator() {
  const [, navigate] = useLocation();

  // Form state
  const [productName, setProductName] = useState("");
  const [listPrice, setListPrice] = useState<number>(0); // 定価
  const [sellingPrice, setSellingPrice] = useState<number>(0); // 販売価格
  const [costPrice, setCostPrice] = useState<number>(0);
  const [grossMarginRate, setGrossMarginRate] = useState<number>(0);
  const [costInputMode, setCostInputMode] = useState<"cost" | "margin">("cost");
  const [hasSet, setHasSet] = useState(false);
  const [bundleName, setBundleName] = useState(""); // セット名
  const [bundlePrice, setBundlePrice] = useState<number>(0); // セット販売価格（売値）
  const [bundleItems, setBundleItems] = useState<Array<{ name: string; price: number }>>([{ name: "", price: 0 }]); // セット内容
  const [expectedAov, setExpectedAov] = useState<number>(0);
  const [selectedLiverId, setSelectedLiverId] = useState<number>(0);
  const [commissionRate, setCommissionRate] = useState<number>(10);
  const [fixedFee, setFixedFee] = useState<number>(0);
  const [contractType, setContractType] = useState<"単発" | "契約" | "完全成果報酬">("単発");
  const [streamDuration, setStreamDuration] = useState<number>(60);
  const [timeSlot, setTimeSlot] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("");
  const [hasAd, setHasAd] = useState(false);
  const [adBudget, setAdBudget] = useState<number>(0);

  // Result state
  const [showResult, setShowResult] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSimilarCases, setShowSimilarCases] = useState(false);
  const [expandedCaseId, setExpandedCaseId] = useState<number | null>(null);

  // Fetch livers
  const { data: liversData } = trpc.liverManagement.list.useQuery();

  // Simulation mutation
  const calculateMutation = trpc.simulation.calculate.useMutation({
    onSuccess: () => {
      setShowResult(true);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Share mutation
  const shareMutation = trpc.simulation.share.useMutation({
    onSuccess: (data) => {
      const url = `${window.location.origin}/proposal/${data.shareToken}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("提案URLをコピーしました");
      setTimeout(() => setCopied(false), 3000);
    },
  });

  const livers = useMemo(() => {
    if (!liversData) return [];
    return liversData
      .filter((l: any) => l.name)
      .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
  }, [liversData]);

  const handleCalculate = () => {
    if (!selectedLiverId) {
      toast.error("ライバーを選択してください");
      return;
    }
    const effectivePrice = hasSet ? bundlePrice : sellingPrice;
    if (!effectivePrice || effectivePrice <= 0) {
      toast.error(hasSet ? "セット販売価格を入力してください" : "販売価格を入力してください");
      return;
    }
    if (!streamDuration || streamDuration <= 0) {
      toast.error("配信時間を入力してください");
      return;
    }

    calculateMutation.mutate({
      productName: productName || undefined,
      unitPrice: effectivePrice,
      listPrice: listPrice > 0 ? listPrice : undefined,
      sellingPrice: sellingPrice > 0 ? sellingPrice : undefined,
      costPrice: costInputMode === "cost" && costPrice > 0 ? costPrice : undefined,
      grossMarginRate: costInputMode === "margin" && grossMarginRate > 0 ? grossMarginRate : undefined,
      hasSet,
      bundleName: hasSet && bundleName ? bundleName : undefined,
      bundlePrice: hasSet && bundlePrice > 0 ? bundlePrice : undefined,
      bundleItems: hasSet && bundleItems.some(i => i.name) ? bundleItems.filter(i => i.name) : undefined,
      expectedAov: expectedAov > 0 ? expectedAov : undefined,
      liverId: selectedLiverId,
      commissionRate,
      fixedFee,
      contractType,
      streamDuration,
      timeSlot: timeSlot || undefined,
      dayOfWeek: dayOfWeek || undefined,
      hasAd,
      adBudget: hasAd && adBudget > 0 ? adBudget : undefined,
    });
  };

  const result = calculateMutation.data;

  return (
    <div className="min-h-screen bg-[#0a192f] text-white relative overflow-hidden">
      <MatrixRain />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/master/livers-dashboard")}
            className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            戻る
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                配信シミュレーター
              </h1>
              <p className="text-sm text-slate-400">
                過去実績ベース × AI予測で配信パフォーマンスを算出
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Input Form */}
          <div className="space-y-6">
            {/* A. Product Conditions */}
            <Card className="bg-[#112240]/80 border-cyan-500/20 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-semibold text-cyan-300">A. 商品条件（SKU）</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-slate-300 text-sm">商品名（任意）</Label>
                    <Input
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="例: KYOGOKU ステムセル フェイシャルオイル"
                      className="bg-[#0a192f] border-slate-600 text-white placeholder:text-slate-500 focus:border-cyan-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300 text-sm">定価</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                        <Input
                          type="number"
                          value={listPrice || ""}
                          onChange={(e) => setListPrice(Number(e.target.value))}
                          placeholder="9,980"
                          className="bg-[#0a192f] border-slate-600 text-white pl-8 focus:border-cyan-500"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-300 text-sm">
                        販売価格 <span className="text-red-400">*</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                        <Input
                          type="number"
                          value={sellingPrice || ""}
                          onChange={(e) => setSellingPrice(Number(e.target.value))}
                          placeholder="7,980"
                          className="bg-[#0a192f] border-slate-600 text-white pl-8 focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 割引率自動表示 */}
                  {listPrice > 0 && sellingPrice > 0 && listPrice > sellingPrice && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <Percent className="w-4 h-4 text-green-400" />
                      <span className="text-green-400 text-sm font-medium">
                        {Math.round((1 - sellingPrice / listPrice) * 100)}%OFF
                      </span>
                      <span className="text-slate-400 text-xs">
                        (定価{formatCurrency(listPrice)} → {formatCurrency(sellingPrice)})
                      </span>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-slate-300 text-sm">原価 / 粗利率</Label>
                      <div className="flex bg-[#0a192f] rounded-md border border-slate-600 overflow-hidden">
                        <button
                          onClick={() => setCostInputMode("cost")}
                          className={`px-3 py-1 text-xs transition-colors ${
                            costInputMode === "cost"
                              ? "bg-cyan-500/20 text-cyan-400"
                              : "text-slate-400 hover:text-slate-300"
                          }`}
                        >
                          原価
                        </button>
                        <button
                          onClick={() => setCostInputMode("margin")}
                          className={`px-3 py-1 text-xs transition-colors ${
                            costInputMode === "margin"
                              ? "bg-cyan-500/20 text-cyan-400"
                              : "text-slate-400 hover:text-slate-300"
                          }`}
                        >
                          粗利率
                        </button>
                      </div>
                    </div>
                    {costInputMode === "cost" ? (
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                        <Input
                          type="number"
                          value={costPrice || ""}
                          onChange={(e) => setCostPrice(Number(e.target.value))}
                          placeholder="1,500"
                          className="bg-[#0a192f] border-slate-600 text-white pl-8 focus:border-cyan-500"
                        />
                      </div>
                    ) : (
                      <div className="relative">
                        <Input
                          type="number"
                          value={grossMarginRate || ""}
                          onChange={(e) => setGrossMarginRate(Number(e.target.value))}
                          placeholder="62"
                          className="bg-[#0a192f] border-slate-600 text-white pr-8 focus:border-cyan-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-sm">セット有無</Label>
                    <Switch checked={hasSet} onCheckedChange={(checked) => {
                      setHasSet(checked);
                      if (!checked) {
                        setBundleName("");
                        setBundlePrice(0);
                        setBundleItems([{ name: "", price: 0 }]);
                      }
                    }} />
                  </div>

                  {/* セット組みセクション */}
                  {hasSet && (
                    <div className="p-4 bg-[#0a192f] rounded-lg border border-purple-500/30 space-y-4">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-purple-400" />
                        <span className="text-purple-300 font-medium text-sm">セット組み</span>
                      </div>

                      <div>
                        <Label className="text-slate-300 text-sm">セット名</Label>
                        <Input
                          value={bundleName}
                          onChange={(e) => setBundleName(e.target.value)}
                          placeholder="例: 2.5NANAやらかし2"
                          className="bg-[#112240] border-slate-600 text-white placeholder:text-slate-500 focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <Label className="text-slate-300 text-sm">
                          セット販売価格（売値） <span className="text-red-400">*</span>
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                          <Input
                            type="number"
                            value={bundlePrice || ""}
                            onChange={(e) => setBundlePrice(Number(e.target.value))}
                            placeholder="9,900"
                            className="bg-[#112240] border-slate-600 text-white pl-8 focus:border-purple-500"
                          />
                        </div>
                      </div>

                      {/* セット内容（商品リスト） */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-slate-300 text-sm">
                            <Tag className="w-3 h-3 inline mr-1" />
                            セット内容
                          </Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setBundleItems([...bundleItems, { name: "", price: 0 }])}
                            className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 h-7 text-xs"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            商品追加
                          </Button>
                        </div>

                        <div className="space-y-2">
                          {bundleItems.map((item, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <Input
                                value={item.name}
                                onChange={(e) => {
                                  const newItems = [...bundleItems];
                                  newItems[index] = { ...newItems[index], name: e.target.value };
                                  setBundleItems(newItems);
                                }}
                                placeholder="商品名"
                                className="bg-[#112240] border-slate-600 text-white placeholder:text-slate-500 focus:border-purple-500 flex-1 text-sm"
                              />
                              <div className="relative w-32">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                                <Input
                                  type="number"
                                  value={item.price || ""}
                                  onChange={(e) => {
                                    const newItems = [...bundleItems];
                                    newItems[index] = { ...newItems[index], price: Number(e.target.value) };
                                    setBundleItems(newItems);
                                  }}
                                  placeholder="定価"
                                  className="bg-[#112240] border-slate-600 text-white pl-6 focus:border-purple-500 text-sm"
                                />
                              </div>
                              {bundleItems.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setBundleItems(bundleItems.filter((_, i) => i !== index))}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* 元値合計・割引率自動計算 */}
                        {(() => {
                          const totalOriginal = bundleItems.reduce((sum, item) => sum + (item.price || 0), 0);
                          const discountRate = totalOriginal > 0 && bundlePrice > 0
                            ? Math.round((1 - bundlePrice / totalOriginal) * 100)
                            : 0;
                          return totalOriginal > 0 ? (
                            <div className="mt-3 p-3 bg-[#112240]/50 rounded-lg border border-slate-700">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-400">元値合計:</span>
                                <span className="text-white font-medium">{formatCurrency(totalOriginal)}</span>
                              </div>
                              {discountRate > 0 && (
                                <div className="flex items-center justify-between text-sm mt-1">
                                  <span className="text-slate-400">セット割引:</span>
                                  <Badge className="bg-green-500/20 text-green-400 border-none">
                                    {discountRate}%OFF
                                  </Badge>
                                </div>
                              )}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-slate-300 text-sm">想定AOV（自動補正可）</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                      <Input
                        type="number"
                        value={expectedAov || ""}
                        onChange={(e) => setExpectedAov(Number(e.target.value))}
                        placeholder={hasSet && bundlePrice ? String(bundlePrice) : sellingPrice ? String(sellingPrice) : "自動"}
                        className="bg-[#0a192f] border-slate-600 text-white pl-8 focus:border-cyan-500"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">空欄の場合は{hasSet ? "セット販売価格" : "販売価格"}を使用</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* B. Liver Conditions */}
            <Card className="bg-[#112240]/80 border-cyan-500/20 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-semibold text-cyan-300">B. ライバー条件</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-slate-300 text-sm">
                      選択ライバー <span className="text-red-400">*</span>
                    </Label>
                    <Select
                      value={selectedLiverId ? String(selectedLiverId) : ""}
                      onValueChange={(v) => setSelectedLiverId(Number(v))}
                    >
                      <SelectTrigger className="bg-[#0a192f] border-slate-600 text-white">
                        <SelectValue placeholder="ライバーを選択" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#112240] border-slate-600">
                        {livers.map((liver: any) => (
                          <SelectItem key={liver.id} value={String(liver.id)} className="text-white hover:bg-cyan-500/20">
                            {liver.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>


                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300 text-sm">成果報酬率</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          value={commissionRate}
                          onChange={(e) => setCommissionRate(Number(e.target.value))}
                          className="bg-[#0a192f] border-slate-600 text-white pr-8 focus:border-cyan-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-300 text-sm">固定報酬</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                        <Input
                          type="number"
                          value={fixedFee || ""}
                          onChange={(e) => setFixedFee(Number(e.target.value))}
                          placeholder="50,000"
                          className="bg-[#0a192f] border-slate-600 text-white pl-8 focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-slate-300 text-sm">契約形態</Label>
                    <Select value={contractType} onValueChange={(v: "単発" | "契約" | "完全成果報酬") => setContractType(v)}>
                      <SelectTrigger className="bg-[#0a192f] border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#112240] border-slate-600">
                        <SelectItem value="単発" className="text-white hover:bg-cyan-500/20">単発</SelectItem>
                        <SelectItem value="契約" className="text-white hover:bg-cyan-500/20">契約</SelectItem>
                        <SelectItem value="完全成果報酬" className="text-white hover:bg-cyan-500/20">完全成果報酬</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* C. Execution Conditions */}
            <Card className="bg-[#112240]/80 border-cyan-500/20 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-semibold text-cyan-300">C. 実施条件</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-slate-300 text-sm">
                      配信時間 <span className="text-red-400">*</span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={streamDuration}
                        onChange={(e) => setStreamDuration(Number(e.target.value))}
                        className="bg-[#0a192f] border-slate-600 text-white focus:border-cyan-500"
                      />
                      <span className="text-slate-400 text-sm whitespace-nowrap">分</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {[30, 60, 90, 120, 180].map((min) => (
                        <button
                          key={min}
                          onClick={() => setStreamDuration(min)}
                          className={`px-3 py-1 rounded-md text-xs transition-colors ${
                            streamDuration === min
                              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                              : "bg-[#0a192f] text-slate-400 border border-slate-600 hover:border-slate-500"
                          }`}
                        >
                          {min}分
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300 text-sm">時間帯</Label>
                      <Select value={timeSlot} onValueChange={setTimeSlot}>
                        <SelectTrigger className="bg-[#0a192f] border-slate-600 text-white">
                          <SelectValue placeholder="選択" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#112240] border-slate-600">
                          <SelectItem value="10:00" className="text-white hover:bg-cyan-500/20">10:00</SelectItem>
                          <SelectItem value="12:00" className="text-white hover:bg-cyan-500/20">12:00</SelectItem>
                          <SelectItem value="14:00" className="text-white hover:bg-cyan-500/20">14:00</SelectItem>
                          <SelectItem value="17:00" className="text-white hover:bg-cyan-500/20">17:00</SelectItem>
                          <SelectItem value="19:00" className="text-white hover:bg-cyan-500/20">19:00</SelectItem>
                          <SelectItem value="20:00" className="text-white hover:bg-cyan-500/20">20:00</SelectItem>
                          <SelectItem value="21:00" className="text-white hover:bg-cyan-500/20">21:00</SelectItem>
                          <SelectItem value="22:00" className="text-white hover:bg-cyan-500/20">22:00</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-slate-300 text-sm">曜日</Label>
                      <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                        <SelectTrigger className="bg-[#0a192f] border-slate-600 text-white">
                          <SelectValue placeholder="選択" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#112240] border-slate-600">
                          <SelectItem value="月" className="text-white hover:bg-cyan-500/20">月曜</SelectItem>
                          <SelectItem value="火" className="text-white hover:bg-cyan-500/20">火曜</SelectItem>
                          <SelectItem value="水" className="text-white hover:bg-cyan-500/20">水曜</SelectItem>
                          <SelectItem value="木" className="text-white hover:bg-cyan-500/20">木曜</SelectItem>
                          <SelectItem value="金" className="text-white hover:bg-cyan-500/20">金曜</SelectItem>
                          <SelectItem value="土" className="text-white hover:bg-cyan-500/20">土曜</SelectItem>
                          <SelectItem value="日" className="text-white hover:bg-cyan-500/20">日曜</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-300 text-sm">広告有無</Label>
                      <Switch checked={hasAd} onCheckedChange={setHasAd} />
                    </div>
                    {hasAd && (
                      <div>
                        <Label className="text-slate-300 text-sm">広告予算</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                          <Input
                            type="number"
                            value={adBudget || ""}
                            onChange={(e) => setAdBudget(Number(e.target.value))}
                            placeholder="100,000"
                            className="bg-[#0a192f] border-slate-600 text-white pl-8 focus:border-cyan-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Calculate Button */}
            <Button
              onClick={handleCalculate}
              disabled={calculateMutation.isPending}
              className="w-full h-14 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-lg rounded-xl shadow-lg shadow-cyan-500/25 transition-all"
            >
              {calculateMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  AI分析中...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  シミュレーション実行
                </div>
              )}
            </Button>
          </div>

          {/* Right: Results */}
          <div className="space-y-6">
            {!result && !calculateMutation.isPending && (
              <Card className="bg-[#112240]/80 border-cyan-500/20 backdrop-blur-sm">
                <CardContent className="p-12 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 rounded-full bg-cyan-500/10 flex items-center justify-center mb-6">
                    <Calculator className="w-10 h-10 text-cyan-400/50" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-300 mb-2">
                    シミュレーション結果
                  </h3>
                  <p className="text-slate-500 text-sm max-w-xs">
                    左の入力フォームに条件を入力し、「シミュレーション実行」をクリックすると、
                    過去実績ベースの予測結果がここに表示されます。
                  </p>
                </CardContent>
              </Card>
            )}

            {calculateMutation.isPending && (
              <Card className="bg-[#112240]/80 border-cyan-500/20 backdrop-blur-sm">
                <CardContent className="p-12 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 rounded-full bg-cyan-500/10 flex items-center justify-center mb-6 animate-pulse">
                    <Brain className="w-10 h-10 text-cyan-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-cyan-300 mb-2">
                    AI分析中...
                  </h3>
                  <p className="text-slate-400 text-sm">
                    AIモデルで配信パフォーマンスを予測しています
                  </p>
                  <div className="mt-4 space-y-2 w-full max-w-xs">
                    <Skeleton className="h-4 bg-slate-700/50" />
                    <Skeleton className="h-4 bg-slate-700/50 w-3/4" />
                    <Skeleton className="h-4 bg-slate-700/50 w-1/2" />
                  </div>
                </CardContent>
              </Card>
            )}

            {result && (
              <>
                {/* Main Results */}
                <Card className="bg-[#112240]/80 border-cyan-500/20 backdrop-blur-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 px-6 py-4 border-b border-cyan-500/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-cyan-400" />
                        <h2 className="text-lg font-semibold text-cyan-300">シミュレーション結果</h2>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.dataSource && (
                          <Badge className={`border-none text-xs ${result.hasRealData ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {result.dataSource}
                          </Badge>
                        )}
                        {result.aiPrediction && (
                          <Badge className="bg-cyan-500/20 text-cyan-400 border-none">
                            AI信頼度: {result.aiPrediction.confidence}%
                          </Badge>
                        )}
                      </div>
                    </div>
                    {!result.hasRealData && (
                      <div className="mt-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <p className="text-xs text-amber-400">
                          ※ このライバーの過去配信実績がないため、業界平均値での推定です。実績が蓄積されると予測精度が向上します。
                        </p>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-6">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-[#0a192f] rounded-xl p-4 border border-cyan-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-4 h-4 text-cyan-400" />
                          <span className="text-sm text-slate-400">想定GMV</span>
                        </div>
                        <div className="text-2xl font-bold text-cyan-400">
                          {formatCurrency(result.estimatedGmv)}
                        </div>
                        {result.aiPrediction?.gmvRange && (
                          <div className="text-xs text-slate-500 mt-1">
                            予測レンジ: {formatCurrency(result.aiPrediction.gmvRange.min)} 〜 {formatCurrency(result.aiPrediction.gmvRange.max)}
                          </div>
                        )}
                      </div>

                      <div className="bg-[#0a192f] rounded-xl p-4 border border-green-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-green-400" />
                          <span className="text-sm text-slate-400">想定利益</span>
                        </div>
                        <div className={`text-2xl font-bold ${result.estimatedNetProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {formatCurrency(result.estimatedNetProfit)}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          粗利: {formatCurrency(result.estimatedGrossProfit)}
                        </div>
                      </div>

                      <div className="bg-[#0a192f] rounded-xl p-4 border border-amber-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart3 className="w-4 h-4 text-amber-400" />
                          <span className="text-sm text-slate-400">ROI</span>
                        </div>
                        <div className={`text-2xl font-bold ${result.estimatedRoi >= 0 ? "text-amber-400" : "text-red-400"}`}>
                          {result.estimatedRoi}%
                        </div>
                      </div>

                      <div className="bg-[#0a192f] rounded-xl p-4 border border-purple-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="w-4 h-4 text-purple-400" />
                          <span className="text-sm text-slate-400">想定販売数</span>
                        </div>
                        <div className="text-2xl font-bold text-purple-400">
                          {result.estimatedSalesCount.toLocaleString()}個
                        </div>
                      </div>
                    </div>

                    {/* Cost Breakdown */}
                    <div className="bg-[#0a192f] rounded-xl p-4 border border-slate-700 mb-4">
                      <h3 className="text-sm font-semibold text-slate-300 mb-3">コスト内訳</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">ライバー報酬（成果報酬）</span>
                          <span className="text-white">
                            {formatCurrency(Math.round(result.estimatedGmv * (commissionRate / 100)))}
                          </span>
                        </div>
                        {fixedFee > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">ライバー報酬（固定）</span>
                            <span className="text-white">{formatCurrency(fixedFee)}</span>
                          </div>
                        )}
                        {hasAd && adBudget > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">広告費</span>
                            <span className="text-white">{formatCurrency(adBudget)}</span>
                          </div>
                        )}
                        <div className="border-t border-slate-700 pt-2 flex justify-between text-sm font-semibold">
                          <span className="text-slate-300">合計コスト</span>
                          <span className="text-cyan-400">{formatCurrency(result.estimatedLiverCost + (hasAd ? (adBudget || 0) : 0))}</span>
                        </div>
                      </div>
                    </div>

                    {/* AI Analysis */}
                    {result.aiPrediction?.reasoning && (
                      <div className="bg-gradient-to-r from-cyan-500/5 to-blue-500/5 rounded-xl p-4 border border-cyan-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="w-4 h-4 text-cyan-400" />
                          <h3 className="text-sm font-semibold text-cyan-300">AI分析コメント</h3>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          {result.aiPrediction.reasoning}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 広告換算値・広告効果ROAS・業界比較 */}
                {result.adMetrics && (
                  <Card className="bg-[#112240]/80 border-cyan-500/20 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Megaphone className="w-5 h-5 text-amber-400" />
                        <h3 className="text-sm font-semibold text-amber-300">広告換算・ブランド露出価値</h3>
                        <Badge className="bg-amber-500/20 text-amber-400 border-none text-[10px]">CPM ¥{result.adMetrics.cpmRate.toLocaleString()}</Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="text-center p-3 bg-[#0a192f] rounded-lg">
                          <div className="text-xs text-slate-400 flex items-center justify-center gap-1"><Eye className="w-3 h-3" />想定曝光量</div>
                          <div className="text-lg font-bold text-amber-400">{result.adMetrics.estimatedImpressions.toLocaleString()}</div>
                          <div className="text-[10px] text-slate-500">{result.adMetrics.brandExposure.avgViewers.toLocaleString()}人×{result.adMetrics.brandExposure.durationMinutes}分</div>
                        </div>
                        <div className="text-center p-3 bg-[#0a192f] rounded-lg">
                          <div className="text-xs text-slate-400">広告換算値</div>
                          <div className="text-lg font-bold text-amber-400">{formatCurrency(result.adMetrics.adConversionValue)}</div>
                          <div className="text-[10px] text-slate-500">CPM ¥{result.adMetrics.cpmRate.toLocaleString()} × 曝光量</div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg p-4 border border-amber-500/20 mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-slate-300">広告効果ROAS</span>
                          <span className="text-2xl font-bold text-amber-400">{result.adMetrics.adEffectRoas}倍</span>
                        </div>
                        <div className="text-xs text-slate-500">(GMV {formatCurrency(result.estimatedGmv)} + 広告換算値 {formatCurrency(result.adMetrics.adConversionValue)}) ÷ 総コスト</div>
                      </div>

                      {/* 業界比較 */}
                      <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-lg p-4 border border-emerald-500/20">
                        <div className="flex items-center gap-2 mb-3">
                          <Trophy className="w-4 h-4 text-emerald-400" />
                          <span className="text-sm font-semibold text-emerald-300">業界比較</span>
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-none text-[10px]">{result.adMetrics.industryComparison.priceLabel}</Badge>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-400">同価格帯の業界平均ROAS</span>
                          <span className="text-sm text-slate-300">{result.adMetrics.industryComparison.industryAvgRoas}倍</span>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-slate-400">この案件の広告効果ROAS</span>
                          <span className="text-sm font-bold text-amber-400">{result.adMetrics.adEffectRoas}倍</span>
                        </div>
                        <div className="relative w-full h-3 bg-[#0a192f] rounded-full overflow-hidden">
                          <div
                            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ${
                              result.adMetrics.industryComparison.isAboveAverage
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                : 'bg-gradient-to-r from-amber-500 to-orange-400'
                            }`}
                            style={{ width: `${Math.min(result.adMetrics.industryComparison.roasVsIndustryPercent, 300) / 3}%` }}
                          />
                        </div>
                        <div className={`text-center mt-2 text-sm font-bold ${
                          result.adMetrics.industryComparison.isAboveAverage ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {result.adMetrics.industryComparison.roasVsIndustryLabel}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Liver Stats - only show when data exists */}
                {result.liverStats && result.liverStats.streamCount > 0 && (
                  <Card className="bg-[#112240]/80 border-cyan-500/20 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Users className="w-5 h-5 text-cyan-400" />
                        <h3 className="text-sm font-semibold text-cyan-300">
                          {result.liverStats.name} の過去実績
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-3 bg-[#0a192f] rounded-lg">
                          <div className="text-xs text-slate-400">配信回数</div>
                          <div className="text-lg font-bold text-white">{result.liverStats.streamCount}回</div>
                        </div>
                        <div className="text-center p-3 bg-[#0a192f] rounded-lg">
                          <div className="text-xs text-slate-400">平均GMV</div>
                          <div className="text-lg font-bold text-cyan-400">{formatCurrency(result.liverStats.avgGmvPerStream)}</div>
                        </div>
                        <div className="text-center p-3 bg-[#0a192f] rounded-lg">
                          <div className="text-xs text-slate-400">時間あたりGMV</div>
                          <div className="text-lg font-bold text-cyan-400">{formatCurrency(result.liverStats.avgGmvPerHour)}</div>
                        </div>
                        <div className="text-center p-3 bg-[#0a192f] rounded-lg">
                          <div className="text-xs text-slate-400">類似案件数</div>
                          <div className="text-lg font-bold text-white">{result.similarCases.length}件</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Similar Cases */}
                {result.similarCases.length > 0 && (
                  <Card className="bg-[#112240]/80 border-cyan-500/20 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <button
                        onClick={() => setShowSimilarCases(!showSimilarCases)}
                        className="flex items-center justify-between w-full"
                      >
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-cyan-400" />
                          <h3 className="text-sm font-semibold text-cyan-300">
                            過去類似案件 ({result.similarCases.length}件)
                          </h3>
                        </div>
                        {showSimilarCases ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                      {showSimilarCases && (
                        <div className="mt-4 space-y-2">
                          {result.similarCases.map((c: any, i: number) => {
                            const isExpanded = expandedCaseId === c.id;
                            return (
                              <div key={c.id || i} className="rounded-lg overflow-hidden">
                                {/* Summary row - clickable */}
                                <button
                                  onClick={() => setExpandedCaseId(isExpanded ? null : c.id)}
                                  className="flex items-center justify-between w-full p-3 bg-[#0a192f] hover:bg-[#0d2247] transition-colors text-sm"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="text-slate-400 min-w-[80px]">{c.date ? new Date(c.date).toLocaleDateString('ja-JP') : "N/A"}</div>
                                    {c.brandName && (
                                      <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-300 px-1.5 py-0">{c.brandName}</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="text-cyan-400 font-semibold">{formatCurrency(c.gmv)}</div>
                                    <div className="text-slate-500 text-xs">{c.duration}分</div>
                                    {isExpanded ? (
                                      <ChevronUp className="w-3 h-3 text-slate-500" />
                                    ) : (
                                      <ChevronDown className="w-3 h-3 text-slate-500" />
                                    )}
                                  </div>
                                </button>

                                {/* Expanded detail */}
                                {isExpanded && (
                                  <div className="bg-[#0a192f]/60 border-t border-cyan-500/10 p-4 space-y-3">
                                    {/* Brand & Product */}
                                    <div className="grid grid-cols-2 gap-3">
                                      {c.brandName && (
                                        <div className="flex items-center gap-2">
                                          <Star className="w-3.5 h-3.5 text-amber-400" />
                                          <span className="text-xs text-slate-400">ブランド:</span>
                                          <span className="text-xs text-white font-medium">{c.brandName}</span>
                                        </div>
                                      )}
                                      {c.productName && (
                                        <div className="flex items-center gap-2">
                                          <ShoppingCart className="w-3.5 h-3.5 text-cyan-400" />
                                          <span className="text-xs text-slate-400">商品:</span>
                                          <span className="text-xs text-white font-medium">{c.productName}</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Metrics grid */}
                                    <div className="grid grid-cols-3 gap-2">
                                      <div className="bg-[#112240]/80 rounded-lg p-2 text-center">
                                        <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1"><Eye className="w-3 h-3" />視聴者</div>
                                        <div className="text-sm font-semibold text-cyan-400">{(c.viewers || 0).toLocaleString()}人</div>
                                      </div>
                                      {c.peakViewers != null && (
                                        <div className="bg-[#112240]/80 rounded-lg p-2 text-center">
                                          <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1"><TrendingUp className="w-3 h-3" />ピーク</div>
                                          <div className="text-sm font-semibold text-amber-400">{c.peakViewers.toLocaleString()}人</div>
                                        </div>
                                      )}
                                      <div className="bg-[#112240]/80 rounded-lg p-2 text-center">
                                        <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1"><Clock className="w-3 h-3" />配信時間</div>
                                        <div className="text-sm font-semibold text-white">{c.duration}分</div>
                                      </div>
                                      <div className="bg-[#112240]/80 rounded-lg p-2 text-center">
                                        <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1"><DollarSign className="w-3 h-3" />GMV</div>
                                        <div className="text-sm font-semibold text-green-400">{formatCurrency(c.gmv)}</div>
                                      </div>
                                      <div className="bg-[#112240]/80 rounded-lg p-2 text-center">
                                        <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1"><ShoppingCart className="w-3 h-3" />販売数</div>
                                        <div className="text-sm font-semibold text-white">{(c.salesCount || 0).toLocaleString()}個</div>
                                      </div>
                                      {c.avgPrice > 0 && (
                                        <div className="bg-[#112240]/80 rounded-lg p-2 text-center">
                                          <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1"><Tag className="w-3 h-3" />平均単価</div>
                                          <div className="text-sm font-semibold text-white">{formatCurrency(c.avgPrice)}</div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Engagement metrics */}
                                    {(c.likes != null || c.comments != null || c.shares != null) && (
                                      <div className="flex items-center gap-4 pt-1">
                                        {c.likes != null && (
                                          <div className="flex items-center gap-1 text-xs text-slate-400">
                                            <ThumbsUp className="w-3 h-3 text-pink-400" />
                                            <span>{c.likes.toLocaleString()}</span>
                                          </div>
                                        )}
                                        {c.comments != null && (
                                          <div className="flex items-center gap-1 text-xs text-slate-400">
                                            <MessageCircle className="w-3 h-3 text-blue-400" />
                                            <span>{c.comments.toLocaleString()}</span>
                                          </div>
                                        )}
                                        {c.shares != null && (
                                          <div className="flex items-center gap-1 text-xs text-slate-400">
                                            <Share2 className="w-3 h-3 text-green-400" />
                                            <span>{c.shares.toLocaleString()}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* CVR / CTR / Impressions */}
                                    {(c.cvr || c.ctr || c.impressions != null) && (
                                      <div className="flex items-center gap-4 pt-1 border-t border-cyan-500/10">
                                        {c.cvr && (
                                          <div className="flex items-center gap-1 text-xs">
                                            <Target className="w-3 h-3 text-cyan-400" />
                                            <span className="text-slate-400">CVR:</span>
                                            <span className="text-white font-medium">{c.cvr}</span>
                                          </div>
                                        )}
                                        {c.ctr && (
                                          <div className="flex items-center gap-1 text-xs">
                                            <Monitor className="w-3 h-3 text-cyan-400" />
                                            <span className="text-slate-400">CTR:</span>
                                            <span className="text-white font-medium">{c.ctr}</span>
                                          </div>
                                        )}
                                        {c.impressions != null && (
                                          <div className="flex items-center gap-1 text-xs">
                                            <Eye className="w-3 h-3 text-cyan-400" />
                                            <span className="text-slate-400">曝光:</span>
                                            <span className="text-white font-medium">{c.impressions.toLocaleString()}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Ad cost & Result */}
                                    {(c.adCost != null || c.result) && (
                                      <div className="flex items-center gap-4 pt-1 border-t border-cyan-500/10">
                                        {c.adCost != null && c.adCost > 0 && (
                                          <div className="flex items-center gap-1 text-xs">
                                            <Banknote className="w-3 h-3 text-amber-400" />
                                            <span className="text-slate-400">広告費:</span>
                                            <span className="text-white font-medium">{formatCurrency(c.adCost)}</span>
                                          </div>
                                        )}
                                        {c.result && (
                                          <Badge
                                            variant="outline"
                                            className={`text-[10px] px-1.5 py-0 ${
                                              c.result === "成功" ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"
                                            }`}
                                          >
                                            {c.result}
                                          </Badge>
                                        )}
                                      </div>
                                    )}

                                    {/* Platform & Start time */}
                                    <div className="flex items-center gap-4 text-[10px] text-slate-500">
                                      {c.platform && <span>プラットフォーム: {c.platform}</span>}
                                      {c.livestreamStartTime && <span>開始時間: {c.livestreamStartTime}</span>}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                            <div className="flex justify-between text-sm">
                              <span className="text-cyan-300 font-semibold">平均</span>
                              <span className="text-cyan-400 font-bold">
                                {formatCurrency(
                                  Math.round(
                                    result.similarCases.reduce((s: number, c: any) => s + c.gmv, 0) /
                                      result.similarCases.length
                                  )
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Share Button */}
                <Card className="bg-[#112240]/80 border-cyan-500/20 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Share2 className="w-5 h-5 text-cyan-400" />
                      <h3 className="text-sm font-semibold text-cyan-300">ブランド向け提案</h3>
                    </div>
                    <p className="text-sm text-slate-400 mb-4">
                      シミュレーション結果をブランド担当者に共有できるURLを生成します。
                      余計な情報は含まれず、想定売上・利益・ROIのみが表示されます。
                    </p>
                    <Button
                      onClick={() => result && shareMutation.mutate({ shareToken: result.shareToken })}
                      disabled={shareMutation.isPending}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 text-white"
                    >
                      {copied ? (
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4" />
                          URLをコピーしました
                        </div>
                      ) : shareMutation.isPending ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          生成中...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <ExternalLink className="w-4 h-4" />
                          提案URLを生成してコピー
                        </div>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Warning */}
                {result.estimatedNetProfit < 0 && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-red-400">赤字リスク</h4>
                      <p className="text-sm text-red-300/80 mt-1">
                        この条件では赤字が予想されます。成果報酬率の引き下げ、固定報酬の見直し、
                        または商品単価の調整を検討してください。
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
