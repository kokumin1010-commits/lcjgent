import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import haptic from "@/lib/haptic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingBag, Coins, Receipt, LogOut, ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle, AlertTriangle, TrendingUp, TrendingDown, ShoppingCart, History, Link2, Copy, RefreshCw, ExternalLink, Upload, Package, Truck, ChevronDown, ChevronUp, CreditCard, Gift, X, Heart, MapPin, User, Pencil, Trash2, Star, Plus, Phone, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export default function LineMypage() {
  const [, setLocation] = useLocation();
  const [historyFilter, setHistoryFilter] = useState<"all" | "earn" | "use">("all");
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [referralBonusBanner, setReferralBonusBanner] = useState<number | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | "active" | "shipped" | "delivered" | "cancelled">("all");
  
  // Check for referral bonus banner on mount
  useEffect(() => {
    const bonus = localStorage.getItem('lcj_referral_bonus');
    if (bonus) {
      setReferralBonusBanner(parseInt(bonus, 10));
      localStorage.removeItem('lcj_referral_bonus');
      haptic.celebration();
    }
  }, []);
  
  const { data: user, isLoading: userLoading } = trpc.lineLogin.me.useQuery();
  
  // セッショントークンをlocalStorageに自動保存（永久ログイン対応）
  // cookieでログインできている場合でも、localStorageにトークンを保存しておくことで
  // /receipt-uploadなど他ページに遷移した際にも認証が通るようにする
  useEffect(() => {
    if (user?.sessionToken) {
      localStorage.setItem('lcj_session_token', user.sessionToken);
    }
  }, [user?.sessionToken]);
  
  const { data: pointsData, isLoading: pointsLoading } = trpc.lineLogin.getMyPoints.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: receipts, isLoading: receiptsLoading } = trpc.lineLogin.getMyReceipts.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = trpc.mall.getMyOrders.useQuery(undefined, {
    enabled: !!user,
  });

  // 注文フィルタリング
  const filteredOrders = orders?.filter((order: any) => {
    if (orderStatusFilter === 'all') return true;
    if (orderStatusFilter === 'active') return ['pending', 'paid', 'confirmed'].includes(order.status);
    if (orderStatusFilter === 'shipped') return order.status === 'shipped';
    if (orderStatusFilter === 'delivered') return order.status === 'delivered';
    if (orderStatusFilter === 'cancelled') return ['cancelled', 'refunded'].includes(order.status);
    return true;
  });

  // 配送業者の追跡URLを生成
  const getTrackingUrl = (carrier: string, trackingNumber: string): string | null => {
    const carrierLower = carrier.toLowerCase();
    if (carrierLower.includes('ヤマト') || carrierLower.includes('yamato') || carrierLower.includes('クロネコ'))
      return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number=${trackingNumber}`;
    if (carrierLower.includes('佐川') || carrierLower.includes('sagawa'))
      return `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${trackingNumber}`;
    if (carrierLower.includes('日本郵便') || carrierLower.includes('ユーパック') || carrierLower.includes('japan post'))
      return `https://trackings.post.japanpost.jp/services/srv/search/?requestNo1=${trackingNumber}`;
    if (carrierLower.includes('西濃') || carrierLower.includes('seino'))
      return `https://track.seino.co.jp/cgi-bin/gnpquery.pgm?GNPNO1=${trackingNumber}`;
    return null;
  };

  const cancelOrderMutation = trpc.mall.cancelMyOrder.useMutation({
    onSuccess: (data) => {
      haptic.warning();
      toast.success(data.message);
      setIsCancelDialogOpen(false);
      setCancelOrderId(null);
      setCancelReason("");
      refetchOrders();
    },
    onError: (error) => {
      toast.error(`キャンセルに失敗しました: ${error.message}`);
    },
  });
  
  // LINE連携状態
  const { data: linkStatus, isLoading: linkStatusLoading, refetch: refetchLinkStatus } = trpc.lineLogin.checkLineLinked.useQuery(undefined, {
    enabled: !!user,
  });
  
  // 有効な連携コード
  const { data: activeCode, refetch: refetchActiveCode } = trpc.lineLogin.getActiveLinkCode.useQuery(undefined, {
    enabled: !!user && !linkStatus?.isLinked,
  });
  
  // 連携コード生成
  const generateCodeMutation = trpc.lineLogin.generateLinkCode.useMutation({
    onSuccess: () => {
      refetchActiveCode();
      toast.success("連携コードを発行しました");
    },
    onError: (error) => {
      toast.error(error.message || "コードの発行に失敗しました");
    },
  });
  
  // コードの残り時間を計算
  const [remainingTime, setRemainingTime] = useState<string | null>(null);
  
  useEffect(() => {
    if (!activeCode?.expiresAt) {
      setRemainingTime(null);
      return;
    }
    
    const updateRemainingTime = () => {
      const expiresAt = new Date(activeCode.expiresAt).getTime();
      const now = Date.now();
      const diff = expiresAt - now;
      
      if (diff <= 0) {
        setRemainingTime(null);
        refetchActiveCode();
        return;
      }
      
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setRemainingTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };
    
    updateRemainingTime();
    const interval = setInterval(updateRemainingTime, 1000);
    return () => clearInterval(interval);
  }, [activeCode?.expiresAt, refetchActiveCode]);
  
  // コードをコピー
  const copyCode = () => {
    if (activeCode?.code) {
      haptic.doubleTap();
      navigator.clipboard.writeText(activeCode.code);
      toast.success("コードをコピーしました");
    }
  };
  
  // フィルタリングされたポイント履歴
  const filteredTransactions = pointsData?.transactions?.filter((tx: any) => {
    if (historyFilter === "all") return true;
    if (historyFilter === "earn") return tx.amount > 0;
    if (historyFilter === "use") return tx.amount < 0;
    return true;
  }) || [];

  const logoutMutation = trpc.lineLogin.logout.useMutation({
    onSuccess: () => {
      // Clear localStorage token
      localStorage.removeItem('line_session_token');
      setLocation("/");
    },
  });

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-rose-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <ShoppingBag className="h-16 w-16 text-rose-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">ログインが必要です</h1>
          <p className="text-muted-foreground mb-6">
            マイページを表示するにはログインしてください。
          </p>
          <Button
            size="lg"
            className="w-full bg-rose-500 hover:bg-rose-600 text-white gap-2"
            onClick={() => setLocation("/line-login")}
          >
            ログイン / 新規登録
          </Button>
          <Button
            variant="ghost"
            className="mt-4 text-muted-foreground"
            onClick={() => setLocation("/")}
          >
            トップページに戻る
          </Button>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="h-3 w-3 mr-1" />審査中</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />承認済み</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" />却下</Badge>;
      case "on_hold":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200"><AlertCircle className="h-3 w-3 mr-1" />保留中</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 text-xs">決済待ち</Badge>;
      case "paid":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">決済済み</Badge>;
      case "confirmed":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">確認済み</Badge>;
      case "shipped":
        return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">発送済み</Badge>;
      case "delivered":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">配達完了</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">キャンセル</Badge>;
      case "refunded":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">返金済み</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-rose-500" />
              <span className="text-lg font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
                マイページ
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {user.pictureUrl && (
                <img src={user.pictureUrl} alt={user.displayName || ""} className="h-8 w-8 rounded-full" />
              )}
              <span className="text-sm font-medium hidden sm:inline">{user.displayName}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* レシート申請 - トップに目立つCTA */}
        <Card className="mb-6 border-rose-300 bg-gradient-to-r from-rose-500 to-pink-500 shadow-lg overflow-hidden">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 h-14 w-14 bg-white/20 rounded-full flex items-center justify-center">
                <Receipt className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white">レシート申請</h3>
                <p className="text-rose-100 text-sm mt-0.5">購入レシートを送ってポイントをGET！</p>
              </div>
              <Button
                className="flex-shrink-0 bg-white text-rose-600 hover:bg-rose-50 font-bold shadow-md"
                onClick={() => {
                  const token = localStorage.getItem('lcj_session_token');
                  if (token) {
                    setLocation(`/receipt-upload?token=${encodeURIComponent(token)}`);
                  } else {
                    setLocation('/receipt-upload');
                  }
                }}
              >
                <Upload className="h-4 w-4 mr-2" />
                申請する
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Friend Referral Challenge Banner */}
        <Card className="mb-6 border-purple-300 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-all"
          onClick={() => setLocation("/friend-challenge")}>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🎰</span>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white">友達招待チャレンジ</h3>
                <p className="text-purple-100 text-xs mt-0.5">友達を招待してルーレットを回そう！ポイントGET✨</p>
              </div>
              <div className="text-white/80">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referral Welcome Banner - Temu-style */}
        {referralBonusBanner && (
          <div
            className="mb-6 rounded-2xl shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-700"
            style={{
              background: 'linear-gradient(135deg, #1a0a0a 0%, #3d0c0c 30%, #6b1111 60%, #1a0a0a 100%)',
            }}
          >
            {/* Animated gold sparkle overlay */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: `${4 + (i % 3) * 2}px`,
                    height: `${4 + (i % 3) * 2}px`,
                    background: `radial-gradient(circle, ${['#ffd700', '#ffaa00', '#fff5cc'][i % 3]} 0%, transparent 70%)`,
                    left: `${(i * 8 + 5) % 95}%`,
                    top: `${(i * 11 + 10) % 85}%`,
                    animation: `sparkle ${1.5 + (i % 3) * 0.7}s ease-in-out ${(i % 5) * 0.4}s infinite`,
                  }}
                />
              ))}
            </div>
            {/* Gold border glow */}
            <div className="absolute inset-0 rounded-2xl" style={{ boxShadow: 'inset 0 0 20px rgba(255,215,0,0.15)' }} />
            
            <button
              onClick={() => {
                haptic.dismiss();
                setReferralBonusBanner(null);
              }}
              className="absolute top-3 right-3 text-yellow-400/60 hover:text-yellow-300 z-20 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="relative z-10 p-5">
              {/* Top badge */}
              <div className="flex justify-center mb-3">
                <span
                  className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full text-xs font-bold tracking-wider"
                  style={{
                    background: 'linear-gradient(90deg, #ffd700, #ffaa00)',
                    color: '#1a0a0a',
                    boxShadow: '0 0 12px rgba(255,215,0,0.4)',
                  }}
                >
                  <Gift className="h-3.5 w-3.5" />
                  WELCOME BONUS
                </span>
              </div>
              
              {/* Points display */}
              <div className="text-center mb-3">
                <div className="inline-flex items-baseline gap-1">
                  <span
                    className="text-4xl font-black tracking-tight"
                    style={{
                      background: 'linear-gradient(180deg, #ffd700 0%, #ffaa00 50%, #ff8800 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      filter: 'drop-shadow(0 2px 4px rgba(255,170,0,0.3))',
                    }}
                  >
                    {referralBonusBanner}
                  </span>
                  <span className="text-xl font-bold text-yellow-400">pt</span>
                </div>
                <p className="text-yellow-100 font-bold text-lg mt-0.5">
                  プレゼント！
                </p>
              </div>
              
              {/* Description */}
              <p className="text-center text-yellow-200/70 text-xs">
                招待特典ポイントが付与されました。お買い物にご利用いただけます。
              </p>
              
              {/* CTA button */}
              <div className="flex justify-center mt-4">
                <button
                  onClick={() => {
                    haptic.doubleTap();
                    setReferralBonusBanner(null);
                  }}
                  className="px-6 py-2 rounded-full text-sm font-bold transition-all hover:scale-105 active:scale-95"
                  style={{
                    background: 'linear-gradient(90deg, #ff3333, #cc0000)',
                    color: '#fff',
                    boxShadow: '0 4px 15px rgba(255,0,0,0.3)',
                  }}
                >
                  お買い物を始める
                </button>
              </div>
            </div>
            
            {/* CSS animation for sparkles */}
            <style>{`
              @keyframes sparkle {
                0%, 100% { opacity: 0; transform: scale(0.5); }
                50% { opacity: 1; transform: scale(1.2); }
              }
            `}</style>
          </div>
        )}
        {/* Points Summary - 改善されたデザイン */}
        <Card className="mb-8 border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-rose-700">
              <div className="h-10 w-10 bg-gradient-to-br from-rose-500 to-pink-500 rounded-full flex items-center justify-center">
                <Coins className="h-5 w-5 text-white" />
              </div>
              保有ポイント
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pointsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-5xl font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
                    {pointsData?.balance.toLocaleString() || 0}
                  </span>
                  <span className="text-xl text-rose-600 font-medium">ポイント</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/60 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <p className="text-sm text-muted-foreground">累計獲得</p>
                    </div>
                    <p className="text-lg font-bold text-green-600">+{pointsData?.lifetimeEarned.toLocaleString() || 0} pt</p>
                  </div>
                  <div className="bg-white/60 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingDown className="h-4 w-4 text-blue-500" />
                      <p className="text-sm text-muted-foreground">累計利用</p>
                    </div>
                    <p className="text-lg font-bold text-blue-600">-{pointsData?.lifetimeUsed.toLocaleString() || 0} pt</p>
                  </div>
                </div>
                {/* Expiring Points Warning */}
                {pointsData?.expiring && (pointsData.expiring.in7Days > 0 || pointsData.expiring.in30Days > 0) && (
                  <div className="mt-4 space-y-2">
                    {pointsData.expiring.in7Days > 0 && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        <span className="text-sm text-red-700">
                          <strong>{pointsData.expiring.in7Days.toLocaleString()}pt</strong> が7日以内に失効
                        </span>
                      </div>
                    )}
                    {pointsData.expiring.in30Days > 0 && pointsData.expiring.in7Days !== pointsData.expiring.in30Days && (
                      <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                        <Clock className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                        <span className="text-sm text-yellow-700">
                          <strong>{pointsData.expiring.in30Days.toLocaleString()}pt</strong> が30日以内に失効予定
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      ※ ポイントは付与日から3ヶ月で失効します
                    </p>
                  </div>
                )}
                <div className="mt-4 pt-4 border-t border-rose-200">
                  <Button 
                    className="w-full bg-rose-500 hover:bg-rose-600 gap-2"
                    onClick={() => setLocation("/mall/products")}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    ポイントで商品を購入
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 sm:grid-cols-7">
            <TabsTrigger value="orders" className="text-xs px-1">注文履歴</TabsTrigger>
            <TabsTrigger value="favorites" className="text-xs px-1 flex items-center gap-0.5">
              <Heart className="h-3 w-3" />
              <span className="hidden sm:inline">お気に入り</span>
            </TabsTrigger>
            <TabsTrigger value="viewed" className="text-xs px-1 flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              <span className="hidden sm:inline">最近見た</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs px-1">ポイント</TabsTrigger>
            <TabsTrigger value="receipts" className="text-xs px-1">レシート</TabsTrigger>
            <TabsTrigger value="addresses" className="text-xs px-1 flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              <span className="hidden sm:inline">住所</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="text-xs px-1 flex items-center gap-0.5">
              <User className="h-3 w-3" />
              <span className="hidden sm:inline">プロフィール</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="h-5 w-5 text-rose-500" />
                      注文履歴
                    </CardTitle>
                    <CardDescription>商品の購入履歴と配送状況</CardDescription>
                  </div>
                  <Select value={orderStatusFilter} onValueChange={(v) => setOrderStatusFilter(v as any)}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="すべて" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      <SelectItem value="active">進行中</SelectItem>
                      <SelectItem value="shipped">発送済み</SelectItem>
                      <SelectItem value="delivered">配達完了</SelectItem>
                      <SelectItem value="cancelled">キャンセル</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : filteredOrders && filteredOrders.length > 0 ? (
                  <div className="space-y-4">
                    {filteredOrders.map((order: any) => {
                      const isExpanded = expandedOrderId === order.id;
                      // 商品小計と送料を計算
                      const itemsSubtotal = order.items?.reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0) || 0;
                      const shippingFee = order.totalAmount - itemsSubtotal;
                      const pointsItemsSubtotal = order.items?.reduce((sum: number, item: any) => sum + (item.pointSubtotal || 0), 0) || 0;
                      return (
                        <div key={order.id} className={`border rounded-lg overflow-hidden transition-shadow ${
                          isExpanded ? 'shadow-md border-rose-200' : 'hover:shadow-sm'
                        }`}>
                          {/* 注文ヘッダー */}
                          <button
                            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                            onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                          >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              {/* 商品サムネイル（最初の商品画像） */}
                              <div className="h-12 w-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                                {order.items?.[0]?.productImageUrl ? (
                                  <img 
                                    src={order.items[0].productImageUrl} 
                                    alt={order.items[0].productName}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center">
                                    <ShoppingBag className="h-6 w-6 text-gray-400" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-sm truncate">
                                    {order.items && order.items.length > 0 
                                      ? order.items[0].productName + (order.items.length > 1 ? ` 他${order.items.length - 1}点` : '')
                                      : `注文 #${order.orderNumber}`}
                                  </p>
                                  {getOrderStatusBadge(order.status)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(order.createdAt), "yyyy年M月d日 HH:mm", { locale: ja })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className="text-right">
                                <p className="font-bold text-rose-600">
                                  {order.paymentMethod === 'points' 
                                    ? `${order.pointsUsed?.toLocaleString()} pt`
                                    : `¥${order.totalAmount?.toLocaleString()}`}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {order.paymentMethod === 'points' ? 'ポイント' : 
                                   order.paymentMethod === 'stripe' ? 'カード' : '代引き'}
                                </p>
                              </div>
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </div>
                          </button>

                          {/* 注文詳細（展開時） */}
                          {isExpanded && (
                            <div className="border-t bg-gray-50/50 p-4 space-y-4">
                              {/* 配送ステータスバー（常に表示） */}
                              {!['cancelled', 'refunded'].includes(order.status) && (
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground mb-3">配送状況</p>
                                  <div className="bg-white rounded-lg p-4">
                                    {/* 横型ステップインジケーター */}
                                    <div className="flex items-center justify-between mb-3">
                                      {[
                                        { key: 'ordered', label: '注文受付', icon: CheckCircle, activeStatuses: ['pending', 'paid', 'confirmed', 'shipped', 'delivered'] },
                                        { key: 'confirmed', label: '確認済み', icon: Package, activeStatuses: ['confirmed', 'shipped', 'delivered'] },
                                        { key: 'shipped', label: '発送済み', icon: Truck, activeStatuses: ['shipped', 'delivered'] },
                                        { key: 'delivered', label: 'お届け済み', icon: CheckCircle, activeStatuses: ['delivered'] },
                                      ].map((step, idx, arr) => {
                                        const isActive = step.activeStatuses.includes(order.status);
                                        const StepIcon = step.icon;
                                        return (
                                          <div key={step.key} className="flex items-center flex-1">
                                            <div className="flex flex-col items-center">
                                              <div className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
                                                isActive 
                                                  ? step.key === 'delivered' ? 'bg-green-500' : 'bg-rose-500'
                                                  : 'bg-gray-200'
                                              }`}>
                                                <StepIcon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                                              </div>
                                              <p className={`text-[10px] mt-1 text-center leading-tight ${
                                                isActive ? 'text-gray-900 font-medium' : 'text-gray-400'
                                              }`}>{step.label}</p>
                                            </div>
                                            {idx < arr.length - 1 && (
                                              <div className={`flex-1 h-0.5 mx-1 mt-[-16px] ${
                                                arr[idx + 1].activeStatuses.includes(order.status) ? 'bg-rose-500' : 'bg-gray-200'
                                              }`} />
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    {/* タイムライン */}
                                    <div className="text-xs text-muted-foreground space-y-1 border-t pt-2">
                                      <div className="flex justify-between">
                                        <span>注文日時</span>
                                        <span>{format(new Date(order.createdAt), "yyyy/MM/dd HH:mm")}</span>
                                      </div>
                                      {order.shippedAt && (
                                        <div className="flex justify-between">
                                          <span>発送日時</span>
                                          <span>{format(new Date(order.shippedAt), "yyyy/MM/dd HH:mm")}</span>
                                        </div>
                                      )}
                                      {order.deliveredAt && (
                                        <div className="flex justify-between">
                                          <span>配達日時</span>
                                          <span>{format(new Date(order.deliveredAt), "yyyy/MM/dd HH:mm")}</span>
                                        </div>
                                      )}
                                    </div>
                                    {/* 配送業者・追跡番号 */}
                                    {(order.shippingCarrier || order.trackingNumber) && (
                                      <div className="border-t pt-2 mt-2 space-y-1 text-sm">
                                        {order.shippingCarrier && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">配送業者</span>
                                            <span className="font-medium">{order.shippingCarrier}</span>
                                          </div>
                                        )}
                                        {order.trackingNumber && (
                                          <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">追跡番号</span>
                                            <div className="flex items-center gap-2">
                                              <span className="font-mono text-xs">{order.trackingNumber}</span>
                                              {order.shippingCarrier && (() => {
                                                const trackingUrl = getTrackingUrl(order.shippingCarrier, order.trackingNumber);
                                                return trackingUrl ? (
                                                  <a 
                                                    href={trackingUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-rose-500 hover:text-rose-600"
                                                    onClick={(e) => e.stopPropagation()}
                                                  >
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                  </a>
                                                ) : null;
                                              })()}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* キャンセル情報 */}
                              {['cancelled', 'refunded'].includes(order.status) && (
                                <div className="bg-red-50 rounded-lg p-3 text-sm">
                                  <div className="flex items-center gap-2 text-red-700 font-medium mb-1">
                                    <XCircle className="h-4 w-4" />
                                    {order.status === 'cancelled' ? 'キャンセル済み' : '返金済み'}
                                  </div>
                                  {order.cancelledAt && (
                                    <p className="text-red-600 text-xs">
                                      {format(new Date(order.cancelledAt), "yyyy年M月d日 HH:mm", { locale: ja })}
                                    </p>
                                  )}
                                  {order.cancelReason && (
                                    <p className="text-red-600 text-xs mt-1">理由: {order.cancelReason}</p>
                                  )}
                                </div>
                              )}

                              {/* 商品一覧 */}
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-2">注文商品（{order.items?.length || 0}点）</p>
                                <div className="space-y-2">
                                  {order.items?.map((item: any) => (
                                    <div 
                                      key={item.id} 
                                      className="flex items-center justify-between bg-white rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setLocation(`/mall/products/${item.productId}`);
                                      }}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="h-14 w-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                                          {item.productImageUrl ? (
                                            <img 
                                              src={item.productImageUrl} 
                                              alt={item.productName}
                                              className="h-full w-full object-cover"
                                            />
                                          ) : (
                                            <div className="h-full w-full flex items-center justify-center">
                                              <ShoppingBag className="h-6 w-6 text-gray-400" />
                                            </div>
                                          )}
                                        </div>
                                        <div>
                                          <p className="font-medium text-sm">{item.productName}</p>
                                          <p className="text-xs text-muted-foreground">
                                            {order.paymentMethod === 'points'
                                              ? `${item.productPointPrice?.toLocaleString()} pt × ${item.quantity}`
                                              : `¥${item.productPrice?.toLocaleString()} × ${item.quantity}`}
                                          </p>
                                        </div>
                                      </div>
                                      <p className="font-medium text-sm flex-shrink-0">
                                        {order.paymentMethod === 'points'
                                          ? `${item.pointSubtotal?.toLocaleString()} pt`
                                          : `¥${item.subtotal?.toLocaleString()}`}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* 配送先 */}
                              {order.shippingAddress && (
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground mb-1">配送先</p>
                                  <div className="bg-white rounded-lg p-3 text-sm">
                                    <p className="font-medium">{order.shippingName}</p>
                                    <p className="text-muted-foreground">
                                      〒{order.shippingPostalCode} {order.shippingAddress}
                                    </p>
                                    {order.shippingPhone && (
                                      <p className="text-muted-foreground">TEL: {order.shippingPhone}</p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* 注文情報（内訳付き） */}
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">注文情報</p>
                                <div className="bg-white rounded-lg p-3 text-sm space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">注文番号</span>
                                    <span className="font-mono text-xs">{order.orderNumber}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">支払方法</span>
                                    <span className="flex items-center gap-1">
                                      {order.paymentMethod === 'stripe' && <CreditCard className="h-3 w-3" />}
                                      {order.paymentMethod === 'points' && <Coins className="h-3 w-3" />}
                                      {order.paymentMethod === 'points' ? 'ポイント' : 
                                       order.paymentMethod === 'stripe' ? 'クレジットカード' : '代引き'}
                                    </span>
                                  </div>
                                  <div className="border-t pt-1 mt-1">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">商品小計</span>
                                      <span>
                                        {order.paymentMethod === 'points'
                                          ? `${pointsItemsSubtotal.toLocaleString()} pt`
                                          : `¥${itemsSubtotal.toLocaleString()}`}
                                      </span>
                                    </div>
                                    {order.paymentMethod === 'points' ? (
                                      // ポイント購入時の送料表示
                                      (() => {
                                        const pointShippingFee = (order.pointsUsed || 0) - pointsItemsSubtotal;
                                        return pointShippingFee > 0 ? (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">送料</span>
                                            <span>{pointShippingFee.toLocaleString()} pt</span>
                                          </div>
                                        ) : (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">送料</span>
                                            <span className="text-green-600 font-medium">無料</span>
                                          </div>
                                        );
                                      })()
                                    ) : (
                                      // 通常購入時の送料表示
                                      shippingFee > 0 ? (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">送料</span>
                                          <span>¥{shippingFee.toLocaleString()}</span>
                                        </div>
                                      ) : (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">送料</span>
                                          <span className="text-green-600 font-medium">無料</span>
                                        </div>
                                      )
                                    )}
                                  </div>
                                  <div className="flex justify-between font-bold border-t pt-1">
                                    <span>合計</span>
                                    <span className="text-rose-600">
                                      {order.paymentMethod === 'points'
                                        ? `${order.pointsUsed?.toLocaleString()} pt`
                                        : `¥${order.totalAmount?.toLocaleString()}`}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* キャンセルボタン（未発送の注文のみ） */}
                              {['pending', 'paid', 'confirmed'].includes(order.status) && (
                                <div className="pt-2 border-t">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCancelOrderId(order.id);
                                      setCancelReason("");
                                      setIsCancelDialogOpen(true);
                                    }}
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    この注文をキャンセル
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>{orderStatusFilter === 'all' ? '注文履歴がありません' : '該当する注文がありません'}</p>
                    <p className="text-sm mt-2">商品を購入すると、ここに表示されます</p>
                    <Button
                      variant="outline"
                      className="mt-4 gap-2"
                      onClick={() => setLocation("/mall/products")}
                    >
                      <ShoppingBag className="h-4 w-4" />
                      商品を見る
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="favorites">
            <FavoritesSection />
          </TabsContent>

          <TabsContent value="viewed">
            <ViewHistorySection />
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <History className="h-5 w-5 text-rose-500" />
                      ポイント履歴
                    </CardTitle>
                    <CardDescription>ポイントの獲得・利用履歴</CardDescription>
                  </div>
                  <Select value={historyFilter} onValueChange={(v) => setHistoryFilter(v as "all" | "earn" | "use")}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="すべて" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      <SelectItem value="earn">獲得のみ</SelectItem>
                      <SelectItem value="use">利用のみ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {pointsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : filteredTransactions.length > 0 ? (
                  <div className="space-y-3">
                    {filteredTransactions.map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between py-3 border-b last:border-0">
                        <div className="flex items-start gap-3">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${tx.amount > 0 ? "bg-green-100" : "bg-red-100"}`}>
                            {tx.amount > 0 ? (
                              <TrendingUp className="h-5 w-5 text-green-600" />
                            ) : (
                              <TrendingDown className="h-5 w-5 text-red-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">
                              {tx.description || (tx.amount > 0 ? "ポイント獲得" : "ポイント利用")}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(tx.createdAt), "yyyy年M月d日 HH:mm", { locale: ja })}
                            </p>
                            {tx.referenceType && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                {tx.referenceType === "receipt" && <Receipt className="h-3 w-3 mr-1" />}
                                {tx.referenceType === "order" && <ShoppingCart className="h-3 w-3 mr-1" />}
                                {tx.referenceType === "receipt" ? "レシート承認" : tx.referenceType === "order" ? "商品購入" : tx.referenceType}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                            {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()} pt
                          </div>
                          <div className="text-xs text-muted-foreground">
                            残高: {tx.balanceAfter?.toLocaleString() || "-"} pt
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Coins className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>{historyFilter === "all" ? "ポイント履歴がありません" : historyFilter === "earn" ? "獲得履歴がありません" : "利用履歴がありません"}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="addresses">
            <AddressBookSection />
          </TabsContent>

          <TabsContent value="profile">
            <ProfileEditSection />
          </TabsContent>

          <TabsContent value="receipts">
            {/* Webフォームへの誘導カード */}
            <Card className="mb-4 border-rose-200 bg-gradient-to-r from-rose-50 to-pink-50">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-100">
                    <Upload className="h-8 w-8 text-rose-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Webフォームでレシートを申請</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      高精度AI解析で確実にポイントが付与されます
                    </p>
                  </div>
                  <Button
                    className="w-full bg-rose-500 hover:bg-rose-600 text-white"
                    onClick={() => {
                      // セッショントークンをURLパラメータに付与して外部ブラウザでも認証を引き継ぐ
                      const token = localStorage.getItem('lcj_session_token');
                      if (token) {
                        setLocation(`/receipt-upload?token=${encodeURIComponent(token)}`);
                      } else {
                        setLocation('/receipt-upload');
                      }
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    レシートをアップロードする
                  </Button>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>1. レシート画像をアップロード</p>
                    <p>2. AIが自動で解析</p>
                    <p>3. 内容を確認して申請完了</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 既存の申請履歴 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">レシート申請履歴</CardTitle>
                <CardDescription>過去のレシート申請状況</CardDescription>
              </CardHeader>
              <CardContent>
                {receiptsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : receipts && receipts.length > 0 ? (
                  <div className="space-y-4">
                    {receipts.map((receipt: any) => (
                      <div key={receipt.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium">{receipt.storeName || "店舗名未確認"}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(receipt.submittedAt), "yyyy/MM/dd HH:mm", { locale: ja })}
                            </p>
                          </div>
                          {getStatusBadge(receipt.status)}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">購入金額: </span>
                            <span className="font-medium">¥{receipt.purchaseAmount?.toLocaleString() || "-"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">獲得ポイント: </span>
                            <span className="font-medium text-rose-500">{receipt.pointsAwarded?.toLocaleString() || "-"} pt</span>
                          </div>
                        </div>
                        {receipt.rejectionReason && (
                          <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                            却下理由: {receipt.rejectionReason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>レシート申請履歴がありません</p>
                    <p className="text-sm mt-2">上のボタンからレシートをアップロードしてポイントを獲得しましょう</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* LINEアカウント連携セクション */}
        <Card className="mt-8 border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700">
              <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-green-500 rounded-full flex items-center justify-center">
                <Link2 className="h-5 w-5 text-white" />
              </div>
              LINEアカウント連携
            </CardTitle>
            <CardDescription>
              LINEを連携すると、レシートをLINEで送信できるようになります
            </CardDescription>
          </CardHeader>
          <CardContent>
            {linkStatusLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              </div>
            ) : linkStatus?.isLinked ? (
              <div className="bg-white/60 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                  <div>
                    <p className="font-bold text-emerald-700">LINE連携済み</p>
                    <p className="text-sm text-muted-foreground">レシートをLINEで送信できます</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {activeCode?.code && remainingTime ? (
                  <div className="bg-white rounded-lg p-4 border-2 border-emerald-200">
                    <p className="text-sm text-muted-foreground mb-2">モール会員用連携コード（有効期限: {remainingTime}）</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-emerald-50 rounded-lg p-3 text-center">
                        <span className="text-3xl font-mono font-bold tracking-widest text-emerald-700">
                          {activeCode.code}
                        </span>
                      </div>
                      <Button variant="outline" size="icon" onClick={copyCode}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-3">
                      このコードをLCJ MALL公式LINEに送信してください
                    </p>
                    <Button
                      variant="outline"
                      className="w-full mt-3 gap-2"
                      onClick={() => generateCodeMutation.mutate()}
                      disabled={generateCodeMutation.isPending}
                    >
                      <RefreshCw className={`h-4 w-4 ${generateCodeMutation.isPending ? 'animate-spin' : ''}`} />
                      新しいコードを発行
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-4">
                      LINEを連携すると、レシートをLINEで送信できるようになります
                    </p>
                    <Button
                      className="w-full bg-emerald-500 hover:bg-emerald-600 gap-2"
                      onClick={() => generateCodeMutation.mutate()}
                      disabled={generateCodeMutation.isPending}
                    >
                      {generateCodeMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4" />
                      )}
                      連携コードを発行
                    </Button>
                  </div>
                )}
                
                {/* LINE連携の手順 */}
                <div className="bg-white/60 rounded-lg p-4 mt-4">
                  <p className="font-medium text-sm mb-3">連携手順</p>
                  <ol className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 h-5 w-5 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                      <span>上の「連携コードを発行」ボタンをタップ</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 h-5 w-5 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                      <span>表示されたコード（M-XXXXXX）をコピー</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 h-5 w-5 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                      <span>LCJ MALL公式LINEにコードを送信</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 h-5 w-5 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                      <span>連携完了！</span>
                    </li>
                  </ol>
                  <a href="https://lin.ee/hpVjAiOe" target="_blank" rel="noopener noreferrer" className="block mt-4">
                    <Button variant="outline" className="w-full gap-2 border-[#06C755] text-[#06C755] hover:bg-[#06C755]/10">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                      </svg>
                      LCJ MALL公式LINEを開く
                    </Button>
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>


      </main>

      {/* 注文キャンセル確認ダイアログ */}
      <Dialog open={isCancelDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCancelDialogOpen(false);
          setCancelOrderId(null);
          setCancelReason("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              注文キャンセルの確認
            </DialogTitle>
            <DialogDescription>
              この操作は取り消せません。本当にキャンセルしますか？
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {cancelOrderId && orders && (() => {
              const targetOrder = orders.find((o: any) => o.id === cancelOrderId);
              if (!targetOrder) return null;
              return (
                <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">注文番号</span>
                    <span className="font-mono text-xs">{targetOrder.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">合計</span>
                    <span className="font-medium text-rose-600">
                      {targetOrder.paymentMethod === 'points'
                        ? `${targetOrder.pointsUsed?.toLocaleString()} pt`
                        : `¥${targetOrder.totalAmount?.toLocaleString()}`}
                    </span>
                  </div>
                  {targetOrder.pointsUsed > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>返還予定ポイント</span>
                      <span className="font-medium">+{targetOrder.pointsUsed.toLocaleString()} pt</span>
                    </div>
                  )}
                </div>
              );
            })()}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">キャンセル理由（任意）</label>
              <textarea
                className="w-full border rounded-lg p-2 text-sm resize-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300 outline-none"
                rows={3}
                placeholder="キャンセル理由を入力してください..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setIsCancelDialogOpen(false);
                  setCancelOrderId(null);
                  setCancelReason("");
                }}
                disabled={cancelOrderMutation.isPending}
              >
                戻る
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => {
                   haptic.warning();
                   if (cancelOrderId) {
                     cancelOrderMutation.mutate({
                       orderId: cancelOrderId,
                       reason: cancelReason || undefined,
                     });
                   }
                 }}
                disabled={cancelOrderMutation.isPending}
              >
                {cancelOrderMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />キャンセル中...</>
                ) : (
                  "キャンセルする"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FavoritesSection() {
  const [, setLocation] = useLocation();
  const { data: favorites, isLoading } = trpc.mall.getFavorites.useQuery();
  const utils = trpc.useUtils();

  const removeFavoriteMutation = trpc.mall.removeFavorite.useMutation({
    onSuccess: () => {
      utils.mall.getFavorites.invalidate();
      utils.mall.getFavoriteIds.invalidate();
      toast.success("お気に入りから削除しました");
    },
    onError: () => {
      toast.error("エラーが発生しました");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Heart className="h-5 w-5 text-pink-500 fill-pink-500" />
          お気に入り商品
        </CardTitle>
        <CardDescription>
          気になる商品をチェック
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
          </div>
        ) : !favorites || favorites.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Heart className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">お気に入りはまだありません</p>
            <p className="text-sm mt-1 text-gray-400">商品一覧でハートをタップして追加しましょう</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 text-pink-500 border-pink-200 hover:bg-pink-50"
              onClick={() => setLocation("/mall/products")}
            >
              <ShoppingBag className="h-4 w-4 mr-1" />
              商品を見る
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {favorites.map((fav) => (
              <div
                key={fav.id}
                className="group relative bg-white rounded-lg border border-gray-100 overflow-hidden hover:shadow-md transition-all cursor-pointer"
                onClick={() => setLocation(`/mall/products/${fav.productId}`)}
              >
                {/* 商品画像 */}
                <div className="aspect-square relative overflow-hidden bg-gray-50">
                  {fav.product.imageUrl ? (
                    <img
                      src={fav.product.imageUrl}
                      alt={fav.product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-8 w-8 text-gray-300" />
                    </div>
                  )}

                  {/* 売り切れ */}
                  {fav.product.stock === 0 && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-white font-bold text-xs bg-black/60 px-2 py-0.5 rounded-full">
                        SOLD OUT
                      </span>
                    </div>
                  )}

                  {/* 削除ボタン */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFavoriteMutation.mutate({ productId: fav.productId });
                    }}
                    className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-white/90 shadow-sm hover:bg-white transition-all active:scale-90 z-10"
                  >
                    <Heart className="h-4 w-4 fill-pink-500 text-pink-500" />
                  </button>
                </div>

                {/* 商品情報 */}
                <div className="p-2">
                  <h4 className="text-xs font-medium text-gray-800 line-clamp-2 leading-tight mb-1">
                    {fav.product.name}
                  </h4>
                  <p className="text-sm font-bold text-pink-600">
                    ¥{fav.product.price.toLocaleString()}
                  </p>
                  {fav.product.pointPrice && (
                    <p className="text-[10px] text-amber-600 font-medium">
                      {fav.product.pointPrice.toLocaleString()} pt
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function ViewHistorySection() {
  const { data: viewHistory, isLoading } = trpc.mall.getViewHistory.useQuery({ limit: 20 });
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-500" />
          最近チェックした商品
        </CardTitle>
        <CardDescription>閲覧した商品の履歴です</CardDescription>
      </CardHeader>
      <CardContent>
        {!viewHistory || viewHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">閲覧履歴はありません</p>
            <p className="text-sm text-gray-400 mt-1">商品を見ると、ここに履歴が表示されます</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setLocation("/mall/products")}
            >
              <ShoppingBag className="h-4 w-4 mr-2" />
              商品を見る
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {viewHistory.map((item) => (
              <div
                key={item.id}
                className="cursor-pointer rounded-lg overflow-hidden border border-gray-100 hover:shadow-md transition-all active:scale-[0.97]"
                onClick={() => setLocation(`/mall/products/${item.productId}`)}
              >
                <div className="aspect-square relative overflow-hidden bg-gray-50">
                  {item.product.imageUrl ? (
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-8 w-8 text-gray-300" />
                    </div>
                  )}
                  {item.product.stock === 0 && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-white font-bold text-xs bg-black/60 px-2 py-0.5 rounded-full">SOLD OUT</span>
                    </div>
                  )}
                  {/* 閲覧時間バッジ */}
                  <div className="absolute bottom-1 left-1">
                    <span className="text-[9px] bg-black/50 text-white px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                      {formatViewedAt(item.viewedAt)}
                    </span>
                  </div>
                </div>
                <div className="p-2">
                  <h4 className="text-xs font-medium text-gray-800 line-clamp-2 leading-tight mb-1">
                    {item.product.name}
                  </h4>
                  <p className="text-sm font-bold text-pink-600">
                    ¥{item.product.price.toLocaleString()}
                  </p>
                  {item.product.pointPrice && (
                    <p className="text-[10px] text-amber-600 font-medium">
                      {item.product.pointPrice.toLocaleString()} pt
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatViewedAt(date: Date | string): string {
  const now = new Date();
  const viewed = new Date(date);
  const diffMs = now.getTime() - viewed.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;
  if (diffDay < 7) return `${diffDay}日前`;
  return format(viewed, "M/d", { locale: ja });
}


// ===== 住所帳セクション =====
function AddressBookSection() {
  const utils = trpc.useUtils();
  const { data: addresses, isLoading } = trpc.mall.getMyAddresses.useQuery();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // フォーム状態
  const [formData, setFormData] = useState({
    label: "自宅",
    recipientName: "",
    phoneNumber: "",
    postalCode: "",
    prefecture: "",
    city: "",
    addressLine1: "",
    addressLine2: "",
  });

  const addMutation = trpc.mall.addAddress.useMutation({
    onSuccess: () => {
      utils.mall.getMyAddresses.invalidate();
      toast.success("住所を追加しました");
      resetForm();
    },
    onError: (err) => toast.error(err.message || "住所の追加に失敗しました"),
  });

  const updateMutation = trpc.mall.updateAddress.useMutation({
    onSuccess: () => {
      utils.mall.getMyAddresses.invalidate();
      toast.success("住所を更新しました");
      resetForm();
    },
    onError: (err) => toast.error(err.message || "住所の更新に失敗しました"),
  });

  const deleteMutation = trpc.mall.deleteAddress.useMutation({
    onSuccess: () => {
      utils.mall.getMyAddresses.invalidate();
      toast.success("住所を削除しました");
      setDeleteConfirmId(null);
    },
    onError: (err) => toast.error(err.message || "住所の削除に失敗しました"),
  });

  const setDefaultMutation = trpc.mall.setDefaultAddress.useMutation({
    onSuccess: () => {
      utils.mall.getMyAddresses.invalidate();
      toast.success("デフォルト住所を変更しました");
    },
    onError: (err) => toast.error(err.message || "変更に失敗しました"),
  });

  // 郵便番号検索
  const searchPostalCode = async (code: string) => {
    const cleaned = code.replace(/[^0-9]/g, "");
    if (cleaned.length !== 7) return;
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleaned}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const r = data.results[0];
        setFormData(prev => ({
          ...prev,
          postalCode: cleaned,
          prefecture: r.address1 || "",
          city: (r.address2 || "") + (r.address3 || ""),
        }));
      }
    } catch {
      // silently fail
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData({
      label: "自宅",
      recipientName: "",
      phoneNumber: "",
      postalCode: "",
      prefecture: "",
      city: "",
      addressLine1: "",
      addressLine2: "",
    });
  };

  const startEdit = (addr: any) => {
    setEditingId(addr.id);
    setIsAdding(false);
    setFormData({
      label: addr.label || "自宅",
      recipientName: addr.recipientName || "",
      phoneNumber: addr.phoneNumber || "",
      postalCode: addr.postalCode || "",
      prefecture: addr.prefecture || "",
      city: addr.city || "",
      addressLine1: addr.addressLine1 || "",
      addressLine2: addr.addressLine2 || "",
    });
  };

  const handleSubmit = () => {
    if (!formData.recipientName || !formData.postalCode || !formData.prefecture || !formData.addressLine1) {
      toast.error("必須項目を入力してください");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...formData });
    } else {
      addMutation.mutate(formData);
    }
  };

  const isSaving = addMutation.isPending || updateMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-rose-500" />
              住所帳
            </CardTitle>
            <CardDescription>配送先住所の管理</CardDescription>
          </div>
          {!isAdding && !editingId && (
            <Button
              size="sm"
              variant="outline"
              className="text-rose-500 border-rose-200 hover:bg-rose-50"
              onClick={() => { resetForm(); setIsAdding(true); }}
            >
              <Plus className="h-4 w-4 mr-1" />
              追加
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 追加/編集フォーム */}
        {(isAdding || editingId) && (
          <div className="border border-rose-200 rounded-lg p-4 bg-rose-50/50 space-y-3">
            <h4 className="font-medium text-sm text-rose-700">
              {editingId ? "住所を編集" : "新しい住所を追加"}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs">ラベル</Label>
                <Select value={formData.label} onValueChange={(v) => setFormData(prev => ({ ...prev, label: v }))}>
                  <SelectTrigger className="h-9 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="自宅">自宅</SelectItem>
                    <SelectItem value="会社">会社</SelectItem>
                    <SelectItem value="配送先">配送先</SelectItem>
                    <SelectItem value="その他">その他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs">受取人名 <span className="text-red-500">*</span></Label>
                <Input
                  className="h-9 bg-white"
                  placeholder="例: 京極 龍"
                  value={formData.recipientName}
                  onChange={(e) => setFormData(prev => ({ ...prev, recipientName: e.target.value }))}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs">電話番号</Label>
                <Input
                  className="h-9 bg-white"
                  placeholder="例: 090-1234-5678"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs">郵便番号 <span className="text-red-500">*</span></Label>
                <Input
                  className="h-9 bg-white"
                  placeholder="例: 1600023"
                  value={formData.postalCode}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, "");
                    setFormData(prev => ({ ...prev, postalCode: v }));
                    if (v.length === 7) searchPostalCode(v);
                  }}
                  maxLength={7}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs">都道府県 <span className="text-red-500">*</span></Label>
                <Input
                  className="h-9 bg-white"
                  placeholder="例: 東京都"
                  value={formData.prefecture}
                  onChange={(e) => setFormData(prev => ({ ...prev, prefecture: e.target.value }))}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs">市区町村</Label>
                <Input
                  className="h-9 bg-white"
                  placeholder="例: 新宿区西新宿"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">番地 <span className="text-red-500">*</span></Label>
                <Input
                  className="h-9 bg-white"
                  placeholder="例: 6-15-1"
                  value={formData.addressLine1}
                  onChange={(e) => setFormData(prev => ({ ...prev, addressLine1: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">建物名・部屋番号</Label>
                <Input
                  className="h-9 bg-white"
                  placeholder="例: マンション名 101号室"
                  value={formData.addressLine2}
                  onChange={(e) => setFormData(prev => ({ ...prev, addressLine2: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                className="bg-rose-500 hover:bg-rose-600 text-white"
                onClick={handleSubmit}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {editingId ? "更新" : "追加"}
              </Button>
              <Button size="sm" variant="ghost" onClick={resetForm}>
                キャンセル
              </Button>
            </div>
          </div>
        )}

        {/* 住所一覧 */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
          </div>
        ) : !addresses || addresses.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MapPin className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">住所が登録されていません</p>
            <p className="text-sm mt-1 text-gray-400">「追加」ボタンから住所を登録しましょう</p>
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr: any) => (
              <div
                key={addr.id}
                className={`border rounded-lg p-3 transition-all ${
                  addr.isDefault
                    ? "border-rose-300 bg-rose-50/50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={addr.isDefault ? "default" : "outline"} className={addr.isDefault ? "bg-rose-500 text-white text-[10px]" : "text-[10px]"}>
                        {addr.label}
                      </Badge>
                      {addr.isDefault && (
                        <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">
                          <Star className="h-2.5 w-2.5 mr-0.5 fill-amber-400" />
                          デフォルト
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium text-sm">{addr.recipientName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      〒{addr.postalCode?.replace(/(\d{3})(\d{4})/, "$1-$2")}
                    </p>
                    <p className="text-xs text-gray-700">
                      {addr.prefecture}{addr.city}{addr.addressLine1}
                      {addr.addressLine2 ? ` ${addr.addressLine2}` : ""}
                    </p>
                    {addr.phoneNumber && (
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {addr.phoneNumber}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-gray-400 hover:text-rose-500"
                      onClick={() => startEdit(addr)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {!addr.isDefault && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-gray-400 hover:text-amber-500"
                          onClick={() => setDefaultMutation.mutate({ id: addr.id })}
                          title="デフォルトに設定"
                        >
                          <Star className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                          onClick={() => setDeleteConfirmId(addr.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* 削除確認 */}
                {deleteConfirmId === addr.id && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                    <p className="text-red-700 mb-2">この住所を削除しますか？</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs"
                        onClick={() => deleteMutation.mutate({ id: addr.id })}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "削除"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setDeleteConfirmId(null)}
                      >
                        キャンセル
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===== プロフィール編集セクション =====
function ProfileEditSection() {
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.lineLogin.getMyProfile.useQuery();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    displayName: "",
    phone: "",
    email: "",
  });

  // プロフィールデータが取得されたらフォームに反映
  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || "",
        phone: profile.phone || "",
        email: profile.email || "",
      });
    }
  }, [profile]);

  const updateMutation = trpc.lineLogin.updateMyProfile.useMutation({
    onSuccess: () => {
      utils.lineLogin.getMyProfile.invalidate();
      toast.success("プロフィールを更新しました");
      setIsEditing(false);
    },
    onError: (err) => toast.error(err.message || "更新に失敗しました"),
  });

  const handleSave = () => {
    if (!formData.displayName.trim()) {
      toast.error("名前を入力してください");
      return;
    }
    updateMutation.mutate({
      displayName: formData.displayName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim() || undefined,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-rose-500" />
              プロフィール
            </CardTitle>
            <CardDescription>アカウント情報の確認・編集</CardDescription>
          </div>
          {!isEditing && (
            <Button
              size="sm"
              variant="outline"
              className="text-rose-500 border-rose-200 hover:bg-rose-50"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-4 w-4 mr-1" />
              編集
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* プロフィール画像 */}
        {profile?.pictureUrl && (
          <div className="flex justify-center">
            <img
              src={profile.pictureUrl}
              alt="プロフィール"
              className="w-20 h-20 rounded-full border-2 border-rose-200 object-cover"
            />
          </div>
        )}

        {isEditing ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">名前 <span className="text-red-500">*</span></Label>
              <Input
                className="h-9"
                placeholder="名前を入力"
                value={formData.displayName}
                onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
              />
              <p className="text-[10px] text-gray-400 mt-1">フルネームでなくてもOKです</p>
            </div>
            <div>
              <Label className="text-xs">電話番号</Label>
              <Input
                className="h-9"
                placeholder="例: 090-1234-5678"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">メールアドレス</Label>
              <Input
                className="h-9"
                type="email"
                placeholder="例: example@email.com"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                className="bg-rose-500 hover:bg-rose-600 text-white"
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                保存
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsEditing(false);
                  if (profile) {
                    setFormData({
                      displayName: profile.displayName || "",
                      phone: profile.phone || "",
                      email: profile.email || "",
                    });
                  }
                }}
              >
                キャンセル
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <User className="h-4 w-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-[10px] text-gray-400">名前</p>
                <p className="text-sm font-medium">{profile?.displayName || "未設定"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Phone className="h-4 w-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-[10px] text-gray-400">電話番号</p>
                <p className="text-sm font-medium">{profile?.phone || "未設定"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Mail className="h-4 w-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-[10px] text-gray-400">メールアドレス</p>
                <p className="text-sm font-medium">{profile?.email || "未設定"}</p>
              </div>
            </div>
            {profile?.lineUserId && (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <svg className="h-4 w-4 text-green-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                </svg>
                <div>
                  <p className="text-[10px] text-gray-400">LINE連携</p>
                  <p className="text-sm font-medium text-green-600">連携済み</p>
                </div>
              </div>
            )}
            {profile?.createdAt && (
              <div className="text-center pt-2">
                <p className="text-[10px] text-gray-400">
                  登録日: {format(new Date(profile.createdAt), "yyyy年M月d日", { locale: ja })}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
