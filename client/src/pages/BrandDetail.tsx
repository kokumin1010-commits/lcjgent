import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ArrowLeft, Plus, Trash2, Edit2, Package, Calendar, DollarSign, Percent, Users, Video, Clock, Eye, FileText, ChevronDown, ChevronUp, MessageSquare, Send, User } from "lucide-react";
import { toast } from "sonner";

const translations = {
  ja: {
    title: "ブランド詳細",
    back: "戻る",
    details: "詳細",
    edit: "編集",
    // KPI
    totalGmv: "GMV実績",
    monthlyGmv: "今月GMV",
    products: "商品",
    livestreams: "直播",
    contracts: "契約",
    commissionRate: "成果報酬",
    manager: "負責人",
    // Tables
    productPerformance: "商品パフォーマンス",
    productName: "商品名",
    listPrice: "定価",
    specialPrice: "特価",
    gmv: "GMV",
    livestreamPerformance: "直播パフォーマンス",
    date: "日付",
    account: "アカウント",
    platform: "プラットフォーム",
    duration: "時間",
    // Contract
    contractInfo: "契約情報",
    serviceType: "サービス種類",
    contractType: "契約形態",
    fixedFee: "固定費",
    startDate: "開始日",
    endDate: "終了日",
    status: "ステータス",
    // Memo
    activityMemos: "活動メモ",
    addMemo: "メモを追加",
    memoPlaceholder: "メモを入力...",
    noMemos: "メモがありません",
    // Basic info dialog
    basicInfo: "基本情報",
    brandName: "ブランド名",
    companyName: "会社名",
    category: "カテゴリー",
    phoneNumber: "電話番号",
    email: "メールアドレス",
    contactPerson: "担当者名",
    memo: "メモ",
    close: "閉じる",
    save: "保存",
    cancel: "キャンセル",
    // Status
    inProgress: "進行中",
    meeting: "打ち合わせ中",
    contracted: "契約済み",
    onHold: "保留",
    ended: "終了",
    // Contract status
    contractActive: "契約中",
    contractCompleted: "完了",
    contractOnHold: "保留",
    contractEnded: "終了",
    // Service types
    tsp: "TSP",
    liveCommerce: "ライブコマース",
    adManagement: "広告運用代行",
    snsManagement: "SNS運用代行",
    otherService: "その他",
    // Contract types
    monthlyContract: "月額契約",
    annualContract: "年間契約",
    oneTimeContract: "単発契約",
    adCampaign: "広告案件",
    otherContract: "その他",
    noData: "-",
    items: "品",
    times: "回",
    cases: "件",
  },
  zh: {
    title: "品牌详情",
    back: "返回",
    details: "详情",
    edit: "编辑",
    // KPI
    totalGmv: "GMV实绩",
    monthlyGmv: "本月GMV",
    products: "商品",
    livestreams: "直播",
    contracts: "合同",
    commissionRate: "成果报酬",
    manager: "负责人",
    // Tables
    productPerformance: "商品表现",
    productName: "商品名",
    listPrice: "定价",
    specialPrice: "特价",
    gmv: "GMV",
    livestreamPerformance: "直播表现",
    date: "日期",
    account: "账号",
    platform: "平台",
    duration: "时长",
    // Contract
    contractInfo: "合同信息",
    serviceType: "服务类型",
    contractType: "合同类型",
    fixedFee: "固定费用",
    startDate: "开始日期",
    endDate: "结束日期",
    status: "状态",
    // Memo
    activityMemos: "活动备忘",
    addMemo: "添加备忘",
    memoPlaceholder: "输入备忘...",
    noMemos: "没有备忘",
    // Basic info dialog
    basicInfo: "基本信息",
    brandName: "品牌名",
    companyName: "公司名",
    category: "类别",
    phoneNumber: "电话号码",
    email: "邮箱地址",
    contactPerson: "负责人",
    memo: "备注",
    close: "关闭",
    save: "保存",
    cancel: "取消",
    // Status
    inProgress: "进行中",
    meeting: "洽谈中",
    contracted: "已签约",
    onHold: "保留",
    ended: "结束",
    // Contract status
    contractActive: "合同中",
    contractCompleted: "已完成",
    contractOnHold: "暂停",
    contractEnded: "已结束",
    // Service types
    tsp: "TSP",
    liveCommerce: "直播电商",
    adManagement: "广告运营代理",
    snsManagement: "SNS运营代理",
    otherService: "其他",
    // Contract types
    monthlyContract: "月度合同",
    annualContract: "年度合同",
    oneTimeContract: "单次合同",
    adCampaign: "广告项目",
    otherContract: "其他",
    noData: "-",
    items: "品",
    times: "回",
    cases: "件",
  },
};

const statusTranslations: Record<string, Record<string, string>> = {
  ja: {
    "進行中": "進行中",
    "打ち合わせ中": "打ち合わせ中",
    "契約済み": "契約済み",
    "保留": "保留",
    "終了": "終了",
    "契約中": "契約中",
    "完了": "完了",
  },
  zh: {
    "進行中": "进行中",
    "打ち合わせ中": "洽谈中",
    "契約済み": "已签约",
    "保留": "保留",
    "終了": "结束",
    "契約中": "合同中",
    "完了": "已完成",
  },
};

const serviceTypeTranslations: Record<string, Record<string, string>> = {
  ja: {
    "TSP": "TSP",
    "ライブコマース": "ライブコマース",
    "広告運用代行": "広告運用代行",
    "SNS運用代行": "SNS運用代行",
    "その他": "その他",
  },
  zh: {
    "TSP": "TSP",
    "ライブコマース": "直播电商",
    "広告運用代行": "广告运营代理",
    "SNS運用代行": "SNS运营代理",
    "その他": "其他",
  },
};

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "-";
  return `¥${value.toLocaleString()}`;
};

const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
};

export default function BrandDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { language } = useLanguage();

  const t = translations[language as keyof typeof translations] || translations.ja;

  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isContractExpanded, setIsContractExpanded] = useState(false);
  const [newMemo, setNewMemo] = useState("");

  // Edit modal states
  const [editProductDialogOpen, setEditProductDialogOpen] = useState(false);
  const [editLivestreamDialogOpen, setEditLivestreamDialogOpen] = useState(false);
  const [editContractDialogOpen, setEditContractDialogOpen] = useState(false);
  const [editMemoDialogOpen, setEditMemoDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editingLivestream, setEditingLivestream] = useState<any>(null);
  const [editingContract, setEditingContract] = useState<any>(null);
  const [editingMemo, setEditingMemo] = useState<any>(null);

  const brandId = parseInt(id || "0");

  // Data fetching
  const { data: brand, isLoading: brandLoading } = trpc.brand.getById.useQuery({ id: brandId });
  const { data: allBrands = [] } = trpc.brand.list.useQuery();
  const { data: products = [], refetch: refetchProducts } = trpc.brandProduct.listByBrand.useQuery({ brandId });
  const { data: livestreams = [], refetch: refetchLivestreams } = trpc.brandLivestream.listByBrand.useQuery({ brandId });
  const { data: contracts = [], refetch: refetchContracts } = trpc.brandContract.listByBrand.useQuery({ brandId }, { enabled: brandId > 0 });
  const { data: memos = [], refetch: refetchMemos } = trpc.brandMemo.listByBrand.useQuery({ brandId });
  const { data: monthlyGmvSummary = [] } = trpc.brandLivestream.monthlyGmvSummary.useQuery({ brandId });
  const { data: lcjStaff = [] } = trpc.brand.getLcjStaff.useQuery({ brandId }, { enabled: brandId > 0 });

  // Mutations
  const createMemoMutation = trpc.brandMemo.create.useMutation({
    onSuccess: () => {
      setNewMemo("");
      refetchMemos();
      toast.success("メモを追加しました");
    },
    onError: () => {
      toast.error("エラーが発生しました");
    },
  });

  const deleteMemoMutation = trpc.brandMemo.delete.useMutation({
    onSuccess: () => {
      refetchMemos();
      toast.success("削除しました");
    },
    onError: () => {
      toast.error("エラーが発生しました");
    },
  });

  // Edit mutations
  const updateProductMutation = trpc.brandProduct.update.useMutation({
    onSuccess: () => {
      refetchProducts();
      setEditProductDialogOpen(false);
      setEditingProduct(null);
      toast.success("商品を更新しました");
    },
    onError: () => {
      toast.error("エラーが発生しました");
    },
  });

  const updateLivestreamMutation = trpc.brandLivestream.update.useMutation({
    onSuccess: () => {
      refetchLivestreams();
      setEditLivestreamDialogOpen(false);
      setEditingLivestream(null);
      toast.success("直播を更新しました");
    },
    onError: () => {
      toast.error("エラーが発生しました");
    },
  });

  const updateContractMutation = trpc.brandContract.update.useMutation({
    onSuccess: () => {
      refetchContracts();
      setEditContractDialogOpen(false);
      setEditingContract(null);
      toast.success("契約を更新しました");
    },
    onError: () => {
      toast.error("エラーが発生しました");
    },
  });

  const updateMemoMutation = trpc.brandMemo.update.useMutation({
    onSuccess: () => {
      refetchMemos();
      setEditMemoDialogOpen(false);
      setEditingMemo(null);
      toast.success("メモを更新しました");
    },
    onError: () => {
      toast.error("エラーが発生しました");
    },
  });

  // Calculate GMV totals
  const totalGmv = monthlyGmvSummary.reduce((sum, m) => sum + (m.gmv || 0), 0);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthData = monthlyGmvSummary.find(m => m.month === currentMonth);
  const monthlyGmvValue = currentMonthData?.gmv || 0;

  // Get primary LCJ staff
  const primaryManager = lcjStaff.length > 0 ? lcjStaff[0].staffName : "-";

  // Get active contract commission rate
  const activeContract = contracts.find(c => c.status === "契約中");
  const commissionRateValue = activeContract?.commissionRate || brand?.commissionRate || "-";

  const handleAddMemo = () => {
    if (!newMemo.trim()) return;
    createMemoMutation.mutate({
      brandId,
      content: newMemo.trim(),
      authorName: "User",
    });
  };

  if (brandLoading || !brand) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-red-500 animate-pulse text-2xl font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: 'linear-gradient(135deg, #0a0008 0%, #1a0010 25%, #0d0005 50%, #150012 75%, #0a0008 100%)' }}>
      {/* CYBERPUNK RED MATRIX BACKGROUND */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Main binary code background image */}
        <div 
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: 'url(/digital-bg.jpeg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: 'saturate(1.5) contrast(1.2)',
          }}
        />
        {/* Animated gradient overlay */}
        <div 
          className="absolute inset-0 animate-pulse"
          style={{
            background: `
              radial-gradient(ellipse at 0% 0%, rgba(255, 0, 50, 0.3) 0%, transparent 50%),
              radial-gradient(ellipse at 100% 0%, rgba(200, 0, 80, 0.25) 0%, transparent 45%),
              radial-gradient(ellipse at 100% 100%, rgba(255, 30, 30, 0.2) 0%, transparent 50%),
              radial-gradient(ellipse at 0% 100%, rgba(180, 0, 60, 0.25) 0%, transparent 45%)
            `,
            animationDuration: '4s',
          }}
        />
        {/* Neon red glow spots */}
        <div className="absolute inset-0" style={{
          background: `
            radial-gradient(circle at 15% 20%, rgba(255, 0, 0, 0.4) 0%, transparent 25%),
            radial-gradient(circle at 85% 30%, rgba(255, 50, 50, 0.3) 0%, transparent 20%),
            radial-gradient(circle at 50% 80%, rgba(200, 0, 50, 0.35) 0%, transparent 30%),
            radial-gradient(circle at 70% 60%, rgba(255, 0, 80, 0.2) 0%, transparent 25%)
          `,
        }} />
        {/* Grid overlay for cyber effect */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `
            linear-gradient(rgba(255, 0, 0, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 0, 0, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }} />
        {/* Scanline effect */}
        <div className="absolute inset-0 opacity-[0.05]" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 0, 0, 0.3) 2px, rgba(255, 0, 0, 0.3) 4px)',
        }} />
        {/* Vignette effect */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.4) 100%)',
        }} />
      </div>

      {/* Main content */}
      <div className="relative z-10 p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-black/90 via-red-950/20 to-black/90 backdrop-blur-xl rounded-xl border border-red-500/50 p-4 md:p-6 shadow-[0_0_50px_rgba(255,0,0,0.3),inset_0_1px_0_rgba(255,100,100,0.1)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate("/brands")}
                className="flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm hidden sm:inline">{t.back}</span>
              </button>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-[0_0_20px_rgba(255,0,0,0.5)] animate-pulse">
                <span className="text-xl">🏢</span>
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,0,0,0.3)]">
                    {t.title}
                  </h1>
                  <Select
                    value={brandId.toString()}
                    onValueChange={(value) => navigate(`/brands/${value}/command`)}
                  >
                    <SelectTrigger className="w-[180px] bg-black/60 border-red-900/50 text-white hover:border-red-500/50 transition-colors">
                      <SelectValue placeholder="ブランドを選択" />
                    </SelectTrigger>
                    <SelectContent className="bg-black/95 border-red-900/50 backdrop-blur-xl">
                      {allBrands.map((b) => (
                        <SelectItem 
                          key={b.id} 
                          value={b.id.toString()}
                          className="text-white hover:bg-red-900/30 focus:bg-red-900/30"
                        >
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-gray-500 text-sm mt-0.5">{brand.companyName || brand.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={`px-3 py-1 text-sm font-medium rounded-lg ${
                brand.status === '契約済み' 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : brand.status === '打ち合わせ中' 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {statusTranslations[language][brand.status] || brand.status}
              </Badge>
              <Button
                variant="outline"
                onClick={() => setIsDetailsDialogOpen(true)}
                className="border-red-900/50 text-gray-300 hover:bg-red-900/20 hover:text-white hover:border-red-500/50"
              >
                {t.details}
              </Button>
              <Button
                onClick={() => navigate(`/brands/${id}/edit`)}
                className="bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-lg shadow-red-500/30"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                {t.edit}
              </Button>
            </div>
          </div>
        </div>

        {/* Main KPI Card */}
        <div className="grid grid-cols-1 gap-4">
          {/* Total GMV - Large card with fire icon */}
          <div className="relative overflow-hidden rounded-xl p-6 group transition-all duration-500 hover:scale-[1.02]" style={{
            background: 'linear-gradient(135deg, rgba(0,0,0,0.9) 0%, rgba(50,0,0,0.8) 50%, rgba(0,0,0,0.9) 100%)',
            border: '2px solid rgba(255, 50, 50, 0.6)',
            boxShadow: '0 0 60px rgba(255, 0, 0, 0.4), inset 0 0 60px rgba(255, 0, 0, 0.1)',
          }}>
            <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/30 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-red-600/20 rounded-full blur-2xl" />
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-red-500/5" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl animate-bounce">🔥</span>
                <span className="text-red-300 text-sm font-bold uppercase tracking-widest">{t.totalGmv}（全期間）</span>
              </div>
              <p 
                className="text-5xl md:text-6xl font-black tracking-tight"
                style={{ 
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#ff2222',
                  textShadow: '0 0 15px rgba(255, 0, 0, 1), 0 0 30px rgba(255, 0, 0, 0.8), 0 0 45px rgba(255, 0, 0, 0.6), 0 0 60px rgba(255, 0, 0, 0.4)',
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              >
                {formatCurrency(totalGmv)}
              </p>
            </div>
          </div>
        </div>

        {/* Sub KPI Cards - Neon Style */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="relative overflow-hidden rounded-xl p-4 transition-all duration-300 hover:scale-105" style={{
            background: 'linear-gradient(135deg, rgba(0,30,50,0.9) 0%, rgba(0,50,80,0.7) 100%)',
            border: '1px solid rgba(0, 255, 255, 0.5)',
            boxShadow: '0 0 25px rgba(0, 255, 255, 0.3), inset 0 0 20px rgba(0, 255, 255, 0.1)',
          }}>
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-5 w-5 text-cyan-300" />
              <span className="text-xs text-cyan-200 uppercase tracking-wider font-bold">{t.products}</span>
            </div>
            <p className="text-3xl font-black" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#00ffff', textShadow: '0 0 10px rgba(0, 255, 255, 0.8)' }}>
              {products.length}<span className="text-sm text-cyan-300 ml-1">{t.items}</span>
            </p>
          </div>
          <div className="relative overflow-hidden rounded-xl p-4 transition-all duration-300 hover:scale-105" style={{
            background: 'linear-gradient(135deg, rgba(50,0,50,0.9) 0%, rgba(80,0,80,0.7) 100%)',
            border: '1px solid rgba(255, 100, 200, 0.5)',
            boxShadow: '0 0 25px rgba(255, 100, 200, 0.3), inset 0 0 20px rgba(255, 100, 200, 0.1)',
          }}>
            <div className="flex items-center gap-2 mb-2">
              <Video className="h-5 w-5 text-pink-300" />
              <span className="text-xs text-pink-200 uppercase tracking-wider font-bold">{t.livestreams}</span>
            </div>
            <p className="text-3xl font-black" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#ff66cc', textShadow: '0 0 10px rgba(255, 100, 200, 0.8)' }}>
              {livestreams.length}<span className="text-sm text-pink-300 ml-1">{t.times}</span>
            </p>
          </div>
          <div className="relative overflow-hidden rounded-xl p-4 transition-all duration-300 hover:scale-105" style={{
            background: 'linear-gradient(135deg, rgba(50,40,0,0.9) 0%, rgba(80,60,0,0.7) 100%)',
            border: '1px solid rgba(255, 200, 50, 0.5)',
            boxShadow: '0 0 25px rgba(255, 200, 50, 0.3), inset 0 0 20px rgba(255, 200, 50, 0.1)',
          }}>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-amber-300" />
              <span className="text-xs text-amber-200 uppercase tracking-wider font-bold">{t.contracts}</span>
            </div>
            <p className="text-3xl font-black" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#ffcc33', textShadow: '0 0 10px rgba(255, 200, 50, 0.8)' }}>
              {contracts.length}<span className="text-sm text-amber-300 ml-1">{t.cases}</span>
            </p>
          </div>
          <div className="relative overflow-hidden rounded-xl p-4 transition-all duration-300 hover:scale-105" style={{
            background: 'linear-gradient(135deg, rgba(40,0,60,0.9) 0%, rgba(60,0,90,0.7) 100%)',
            border: '1px solid rgba(180, 100, 255, 0.5)',
            boxShadow: '0 0 25px rgba(180, 100, 255, 0.3), inset 0 0 20px rgba(180, 100, 255, 0.1)',
          }}>
            <div className="flex items-center gap-2 mb-2">
              <Percent className="h-5 w-5 text-purple-300" />
              <span className="text-xs text-purple-200 uppercase tracking-wider font-bold">{t.commissionRate}</span>
            </div>
            <p className="text-3xl font-black" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#bb66ff', textShadow: '0 0 10px rgba(180, 100, 255, 0.8)' }}>
              {commissionRateValue}
            </p>
          </div>
          <div className="bg-black/85 backdrop-blur-xl rounded-xl border border-red-900/30 p-4 hover:border-red-500/50 transition-all">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-green-400" />
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t.manager}</span>
            </div>
            <p className="text-lg font-bold text-green-400 truncate">
              {primaryManager}
            </p>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product Performance Table */}
          <div className="bg-black/85 backdrop-blur-xl rounded-xl border border-red-900/30 p-4 md:p-6 shadow-[0_0_30px_rgba(255,0,0,0.1)]">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-cyan-400 to-cyan-600 rounded-full" />
              {t.productPerformance}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-red-900/30">
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2 w-16"></th>
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.productName}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.listPrice}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.specialPrice}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.gmv}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.commissionRate}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-gray-500 py-8">{t.noData}</td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr key={product.id} className="border-b border-red-900/20 hover:bg-red-900/10 transition-colors group">
                        <td className="py-3 px-2">
                          {product.imageUrls && product.imageUrls.length > 0 ? (
                            <img src={product.imageUrls[0]} alt={product.productName} className="w-12 h-12 object-cover rounded-lg border border-red-900/30" />
                          ) : (
                            <div className="w-12 h-12 bg-red-900/20 rounded-lg border border-red-900/30 flex items-center justify-center">
                              <Package className="w-6 h-6 text-gray-600" />
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2 text-white font-medium">{product.productName}</td>
                        <td className="py-3 px-2 text-right text-gray-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {formatCurrency(product.listPrice)}
                        </td>
                        <td className="py-3 px-2 text-right text-red-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {formatCurrency(product.specialPrice)}
                        </td>
                        <td className="py-3 px-2 text-right text-cyan-400 font-bold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          -
                        </td>
                        <td className="py-3 px-2 text-right text-purple-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {product.commissionRate || "-"}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <button
                            onClick={() => { setEditingProduct(product); setEditProductDialogOpen(true); }}
                            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-cyan-400 transition-all"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Livestream Performance Table */}
          <div className="bg-black/85 backdrop-blur-xl rounded-xl border border-red-900/30 p-4 md:p-6 shadow-[0_0_30px_rgba(255,0,0,0.1)]">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-pink-400 to-pink-600 rounded-full" />
              {t.livestreamPerformance}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-red-900/30">
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.date}</th>
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.account}</th>
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.platform}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.gmv}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.duration}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {livestreams.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-gray-500 py-8">{t.noData}</td>
                    </tr>
                  ) : (
                    livestreams.slice(0, 10).map((ls) => (
                      <tr key={ls.id} className="border-b border-red-900/20 hover:bg-red-900/10 transition-colors group">
                        <td className="py-3 px-2 text-gray-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {formatDate(ls.livestreamDate)}
                        </td>
                        <td className="py-3 px-2 text-white font-medium">{ls.streamerName}</td>
                        <td className="py-3 px-2 text-gray-400">{ls.platform || "-"}</td>
                        <td className="py-3 px-2 text-right text-pink-400 font-bold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {formatCurrency(ls.gmv || ls.salesAmount)}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {ls.duration ? `${ls.duration}分` : "-"}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <button
                            onClick={() => { setEditingLivestream(ls); setEditLivestreamDialogOpen(true); }}
                            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-pink-400 transition-all"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Contract Section - Collapsible */}
        <Collapsible open={isContractExpanded} onOpenChange={setIsContractExpanded}>
          <div className="bg-black/85 backdrop-blur-xl rounded-xl border border-red-900/30 shadow-[0_0_30px_rgba(255,0,0,0.1)]">
            <CollapsibleTrigger className="w-full p-4 md:p-6 flex items-center justify-between hover:bg-red-900/10 transition-colors rounded-xl">
              <h2 className="text-lg font-bold text-white flex items-center gap-3">
                <div className="w-1 h-6 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full" />
                {t.contractInfo}
                <Badge className="ml-2 bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {contracts.length}
                </Badge>
              </h2>
              {isContractExpanded ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 md:px-6 pb-4 md:pb-6">
                {contracts.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">{t.noData}</p>
                ) : (
                  <div className="space-y-3">
                    {contracts.map((contract) => (
                      <div key={contract.id} className="bg-black/50 rounded-lg border border-red-900/20 p-4 group">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              {serviceTypeTranslations[language][contract.serviceType] || contract.serviceType}
                            </Badge>
                            <Badge className={`${
                              contract.status === '契約中' 
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                            }`}>
                              {statusTranslations[language][contract.status] || contract.status}
                            </Badge>
                          </div>
                          <button
                            onClick={() => { setEditingContract(contract); setEditContractDialogOpen(true); }}
                            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-amber-400 transition-all"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{t.fixedFee}</p>
                            <p className="text-white font-mono">{formatCurrency(contract.fixedFee)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{t.commissionRate}</p>
                            <p className="text-purple-400 font-mono">{contract.commissionRate || "-"}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{t.startDate}</p>
                            <p className="text-white font-mono">{formatDate(contract.startDate)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{t.endDate}</p>
                            <p className="text-white font-mono">{formatDate(contract.endDate)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Activity Memos - Timeline */}
        <div className="bg-black/85 backdrop-blur-xl rounded-xl border border-red-900/30 p-4 md:p-6 shadow-[0_0_30px_rgba(255,0,0,0.1)]">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
            <div className="w-1 h-6 bg-gradient-to-b from-green-400 to-green-600 rounded-full" />
            {t.activityMemos}
          </h2>

          {/* Add memo input */}
          <div className="flex gap-3 mb-6">
            <Input
              value={newMemo}
              onChange={(e) => setNewMemo(e.target.value)}
              placeholder={t.memoPlaceholder}
              className="flex-1 bg-black/50 border-red-900/30 text-white placeholder:text-gray-600 focus:border-red-500/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddMemo();
                }
              }}
            />
            <Button
              onClick={handleAddMemo}
              disabled={!newMemo.trim() || createMemoMutation.isPending}
              className="bg-gradient-to-r from-green-700 to-green-600 hover:from-green-600 hover:to-green-500 text-white shadow-lg shadow-green-500/30"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Memos timeline */}
          <div className="space-y-4">
            {memos.length === 0 ? (
              <p className="text-gray-500 text-center py-8">{t.noMemos}</p>
            ) : (
              memos.map((memo, index) => (
                <div key={memo.id} className="relative pl-6 pb-4">
                  {/* Timeline line */}
                  {index < memos.length - 1 && (
                    <div className="absolute left-[9px] top-6 bottom-0 w-0.5 bg-red-900/30" />
                  )}
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-1 w-[18px] h-[18px] rounded-full bg-red-900/50 border-2 border-red-500/50 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                  </div>
                  {/* Content */}
                  <div className="bg-black/50 rounded-lg border border-red-900/20 p-4 hover:border-red-500/30 transition-colors group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-white whitespace-pre-wrap">{memo.content}</p>
                        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {memo.authorName}
                          </span>
                          <span>
                            {new Date(memo.createdAt).toLocaleString("ja-JP")}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditingMemo(memo); setEditMemoDialogOpen(true); }}
                          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-green-400 transition-all"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteMemoMutation.mutate({ id: memo.id })}
                          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Product Edit Dialog */}
      <Dialog open={editProductDialogOpen} onOpenChange={setEditProductDialogOpen}>
        <DialogContent className="bg-black/95 border-red-900/50 text-white max-w-lg backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-cyan-400 to-cyan-600 rounded-full" />
              商品編集
            </DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-gray-400">商品名</Label>
                <Input
                  value={editingProduct.productName || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, productName: e.target.value })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">定価</Label>
                  <Input
                    type="number"
                    value={editingProduct.listPrice || ""}
                    onChange={(e) => setEditingProduct({ ...editingProduct, listPrice: parseInt(e.target.value) || 0 })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">特価</Label>
                  <Input
                    type="number"
                    value={editingProduct.specialPrice || ""}
                    onChange={(e) => setEditingProduct({ ...editingProduct, specialPrice: parseInt(e.target.value) || 0 })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-400">成果報酬</Label>
                <Input
                  value={editingProduct.commissionRate || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, commissionRate: e.target.value })}
                  placeholder="例: 15%"
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-400">備考</Label>
                <Textarea
                  value={editingProduct.remarks || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, remarks: e.target.value })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setEditProductDialogOpen(false); setEditingProduct(null); }}
              className="border-red-900/50 text-gray-300 hover:bg-red-900/20 hover:text-white"
            >
              {t.cancel}
            </Button>
            <Button
              onClick={() => {
                if (editingProduct) {
                  updateProductMutation.mutate({
                    id: editingProduct.id,
                    productName: editingProduct.productName,
                    listPrice: editingProduct.listPrice,
                    specialPrice: editingProduct.specialPrice,
                    discountRate: editingProduct.commissionRate,
                    remarks: editingProduct.remarks,
                  });
                }
              }}
              className="bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white"
            >
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Livestream Edit Dialog */}
      <Dialog open={editLivestreamDialogOpen} onOpenChange={setEditLivestreamDialogOpen}>
        <DialogContent className="bg-black/95 border-red-900/50 text-white max-w-lg backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-pink-400 to-pink-600 rounded-full" />
              直播編集
            </DialogTitle>
          </DialogHeader>
          {editingLivestream && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">日付</Label>
                  <Input
                    type="date"
                    value={editingLivestream.livestreamDate ? new Date(editingLivestream.livestreamDate).toISOString().split('T')[0] : ""}
                    onChange={(e) => setEditingLivestream({ ...editingLivestream, livestreamDate: e.target.value })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">アカウント</Label>
                  <Input
                    value={editingLivestream.streamerName || ""}
                    onChange={(e) => setEditingLivestream({ ...editingLivestream, streamerName: e.target.value })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">プラットフォーム</Label>
                  <Select
                    value={editingLivestream.platform || ""}
                    onValueChange={(value) => setEditingLivestream({ ...editingLivestream, platform: value })}
                  >
                    <SelectTrigger className="bg-black/60 border-red-900/50 text-white mt-1">
                      <SelectValue placeholder="選択" />
                    </SelectTrigger>
                    <SelectContent className="bg-black/95 border-red-900/50">
                      <SelectItem value="TikTok">TikTok</SelectItem>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                      <SelectItem value="YouTube">YouTube</SelectItem>
                      <SelectItem value="その他">その他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-400">時間（分）</Label>
                  <Input
                    type="number"
                    value={editingLivestream.duration || ""}
                    onChange={(e) => setEditingLivestream({ ...editingLivestream, duration: parseInt(e.target.value) || 0 })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-400">GMV</Label>
                <Input
                  type="number"
                  value={editingLivestream.gmv || editingLivestream.salesAmount || ""}
                  onChange={(e) => setEditingLivestream({ ...editingLivestream, gmv: parseInt(e.target.value) || 0 })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-400">備考</Label>
                <Textarea
                  value={editingLivestream.remarks || ""}
                  onChange={(e) => setEditingLivestream({ ...editingLivestream, remarks: e.target.value })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setEditLivestreamDialogOpen(false); setEditingLivestream(null); }}
              className="border-red-900/50 text-gray-300 hover:bg-red-900/20 hover:text-white"
            >
              {t.cancel}
            </Button>
            <Button
              onClick={() => {
                if (editingLivestream) {
                  updateLivestreamMutation.mutate({
                    id: editingLivestream.id,
                    livestreamDate: editingLivestream.livestreamDate,
                    streamerName: editingLivestream.streamerName,
                    platform: editingLivestream.platform,
                    duration: editingLivestream.duration,
                    gmv: editingLivestream.gmv,
                    remarks: editingLivestream.remarks,
                  });
                }
              }}
              className="bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 text-white"
            >
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract Edit Dialog */}
      <Dialog open={editContractDialogOpen} onOpenChange={setEditContractDialogOpen}>
        <DialogContent className="bg-black/95 border-red-900/50 text-white max-w-lg backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full" />
              契約編集
            </DialogTitle>
          </DialogHeader>
          {editingContract && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">サービス種類</Label>
                  <Select
                    value={editingContract.serviceType || ""}
                    onValueChange={(value) => setEditingContract({ ...editingContract, serviceType: value })}
                  >
                    <SelectTrigger className="bg-black/60 border-red-900/50 text-white mt-1">
                      <SelectValue placeholder="選択" />
                    </SelectTrigger>
                    <SelectContent className="bg-black/95 border-red-900/50">
                      <SelectItem value="TSP">TSP</SelectItem>
                      <SelectItem value="ライブコマース">ライブコマース</SelectItem>
                      <SelectItem value="広告運用代行">広告運用代行</SelectItem>
                      <SelectItem value="SNS運用代行">SNS運用代行</SelectItem>
                      <SelectItem value="その他">その他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-400">ステータス</Label>
                  <Select
                    value={editingContract.status || ""}
                    onValueChange={(value) => setEditingContract({ ...editingContract, status: value })}
                  >
                    <SelectTrigger className="bg-black/60 border-red-900/50 text-white mt-1">
                      <SelectValue placeholder="選択" />
                    </SelectTrigger>
                    <SelectContent className="bg-black/95 border-red-900/50">
                      <SelectItem value="契約中">契約中</SelectItem>
                      <SelectItem value="完了">完了</SelectItem>
                      <SelectItem value="保留">保留</SelectItem>
                      <SelectItem value="終了">終了</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">固定費</Label>
                  <Input
                    type="number"
                    value={editingContract.fixedFee || ""}
                    onChange={(e) => setEditingContract({ ...editingContract, fixedFee: parseInt(e.target.value) || 0 })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">成果報酬</Label>
                  <Input
                    value={editingContract.commissionRate || ""}
                    onChange={(e) => setEditingContract({ ...editingContract, commissionRate: e.target.value })}
                    placeholder="例: 15-20%"
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">開始日</Label>
                  <Input
                    type="date"
                    value={editingContract.startDate ? new Date(editingContract.startDate).toISOString().split('T')[0] : ""}
                    onChange={(e) => setEditingContract({ ...editingContract, startDate: new Date(e.target.value) })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">終了日</Label>
                  <Input
                    type="date"
                    value={editingContract.endDate ? new Date(editingContract.endDate).toISOString().split('T')[0] : ""}
                    onChange={(e) => setEditingContract({ ...editingContract, endDate: new Date(e.target.value) })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-400">メモ</Label>
                <Textarea
                  value={editingContract.memo || ""}
                  onChange={(e) => setEditingContract({ ...editingContract, memo: e.target.value })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setEditContractDialogOpen(false); setEditingContract(null); }}
              className="border-red-900/50 text-gray-300 hover:bg-red-900/20 hover:text-white"
            >
              {t.cancel}
            </Button>
            <Button
              onClick={() => {
                if (editingContract) {
                  updateContractMutation.mutate({
                    id: editingContract.id,
                    serviceType: editingContract.serviceType,
                    status: editingContract.status,
                    fixedFee: editingContract.fixedFee,
                    commissionRate: editingContract.commissionRate,
                    startDate: editingContract.startDate,
                    endDate: editingContract.endDate,
                    memo: editingContract.memo,
                  });
                }
              }}
              className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white"
            >
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Memo Edit Dialog */}
      <Dialog open={editMemoDialogOpen} onOpenChange={setEditMemoDialogOpen}>
        <DialogContent className="bg-black/95 border-red-900/50 text-white max-w-lg backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-green-400 to-green-600 rounded-full" />
              メモ編集
            </DialogTitle>
          </DialogHeader>
          {editingMemo && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-gray-400">メモ内容</Label>
                <Textarea
                  value={editingMemo.content || ""}
                  onChange={(e) => setEditingMemo({ ...editingMemo, content: e.target.value })}
                  className="bg-black/60 border-red-900/50 text-white mt-1 min-h-[120px]"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setEditMemoDialogOpen(false); setEditingMemo(null); }}
              className="border-red-900/50 text-gray-300 hover:bg-red-900/20 hover:text-white"
            >
              {t.cancel}
            </Button>
            <Button
              onClick={() => {
                if (editingMemo) {
                  updateMemoMutation.mutate({
                    id: editingMemo.id,
                    content: editingMemo.content,
                  });
                }
              }}
              className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white"
            >
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="bg-black/95 border-red-900/50 text-white max-w-lg backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-red-400 to-red-600 rounded-full" />
              {t.basicInfo}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.brandName}</p>
                <p className="text-white font-medium">{brand.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.companyName}</p>
                <p className="text-white font-medium">{brand.companyName || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.category}</p>
                <p className="text-white font-medium">{brand.category || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.status}</p>
                <Badge className={`${
                  brand.status === '契約済み' 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                    : brand.status === '打ち合わせ中' 
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {statusTranslations[language][brand.status] || brand.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.phoneNumber}</p>
                <p className="text-white font-mono">{brand.phoneNumber || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.email}</p>
                <p className="text-white">{brand.email || "-"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.contactPerson}</p>
                <p className="text-white font-medium">{brand.contactPerson || "-"}</p>
              </div>
            </div>
            {brand.memo && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.memo}</p>
                <p className="text-gray-300 whitespace-pre-wrap bg-black/50 rounded-lg p-3 border border-red-900/20">
                  {brand.memo}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDetailsDialogOpen(false)}
              className="border-red-900/50 text-gray-300 hover:bg-red-900/20 hover:text-white"
            >
              {t.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
