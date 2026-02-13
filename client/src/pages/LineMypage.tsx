import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingBag, Coins, Receipt, LogOut, ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle, TrendingUp, TrendingDown, ShoppingCart, History, Link2, Copy, RefreshCw, ExternalLink, Upload, Package, Truck, ChevronDown, ChevronUp, CreditCard, Gift, X } from "lucide-react";
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
  
  // Check for referral bonus banner on mount
  useEffect(() => {
    const bonus = localStorage.getItem('lcj_referral_bonus');
    if (bonus) {
      setReferralBonusBanner(parseInt(bonus, 10));
      localStorage.removeItem('lcj_referral_bonus');
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

  const cancelOrderMutation = trpc.mall.cancelMyOrder.useMutation({
    onSuccess: (data) => {
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

        {/* Referral Bonus Banner */}
        {referralBonusBanner && (
          <div className="mb-6 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <button
              onClick={() => setReferralBonusBanner(null)}
              className="absolute top-2 right-2 text-amber-800 hover:text-amber-900 z-10"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3 relative z-10">
              <div className="h-12 w-12 bg-white/30 rounded-full flex items-center justify-center flex-shrink-0">
                <Gift className="h-6 w-6 text-amber-800" />
              </div>
              <div>
                <p className="text-amber-900 font-bold text-lg">
                  {referralBonusBanner}pt 獲得しました！
                </p>
                <p className="text-amber-800 text-sm">
                  紹介コード特典のポイントが付与されました。商品購入にご利用いただけます。
                </p>
              </div>
            </div>
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="orders">注文履歴</TabsTrigger>
            <TabsTrigger value="history">ポイント履歴</TabsTrigger>
            <TabsTrigger value="receipts">レシート申請</TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-rose-500" />
                  注文履歴
                </CardTitle>
                <CardDescription>商品の購入履歴と配送状況</CardDescription>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : orders && orders.length > 0 ? (
                  <div className="space-y-4">
                    {orders.map((order: any) => {
                      const isExpanded = expandedOrderId === order.id;
                      return (
                        <div key={order.id} className="border rounded-lg overflow-hidden">
                          {/* 注文ヘッダー */}
                          <button
                            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                            onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                          >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                order.status === 'delivered' ? 'bg-green-100' :
                                order.status === 'shipped' ? 'bg-blue-100' :
                                order.status === 'paid' || order.status === 'confirmed' ? 'bg-yellow-100' :
                                order.status === 'cancelled' || order.status === 'refunded' ? 'bg-red-100' :
                                'bg-gray-100'
                              }`}>
                                {order.status === 'delivered' ? <CheckCircle className="h-5 w-5 text-green-600" /> :
                                 order.status === 'shipped' ? <Truck className="h-5 w-5 text-blue-600" /> :
                                 order.status === 'paid' || order.status === 'confirmed' ? <Package className="h-5 w-5 text-yellow-600" /> :
                                 order.status === 'cancelled' || order.status === 'refunded' ? <XCircle className="h-5 w-5 text-red-600" /> :
                                 <Clock className="h-5 w-5 text-gray-600" />}
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
                              {/* 商品一覧 */}
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-2">注文商品</p>
                                <div className="space-y-2">
                                  {order.items?.map((item: any) => (
                                    <div key={item.id} className="flex items-center justify-between bg-white rounded-lg p-3">
                                      <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                          <ShoppingBag className="h-6 w-6 text-gray-400" />
                                        </div>
                                        <div>
                                          <p className="font-medium text-sm">{item.productName}</p>
                                          <p className="text-xs text-muted-foreground">数量: {item.quantity}</p>
                                        </div>
                                      </div>
                                      <p className="font-medium text-sm">
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

                              {/* 配送状況 */}
                              {(order.status === 'shipped' || order.status === 'delivered' || order.trackingNumber || order.shippingCarrier) && (
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground mb-2">配送状況</p>
                                  <div className="bg-white rounded-lg p-3 text-sm space-y-2">
                                    {/* 配送ステップ */}
                                    <div className="flex items-center gap-3">
                                      <div className="flex flex-col items-center">
                                        <div className={`h-6 w-6 rounded-full flex items-center justify-center ${order.status === 'pending' ? 'bg-gray-200' : 'bg-green-500'}`}>
                                          <CheckCircle className={`h-3 w-3 ${order.status === 'pending' ? 'text-gray-400' : 'text-white'}`} />
                                        </div>
                                        <div className={`w-0.5 h-4 ${['shipped', 'delivered'].includes(order.status) ? 'bg-green-500' : 'bg-gray-200'}`} />
                                        <div className={`h-6 w-6 rounded-full flex items-center justify-center ${['shipped', 'delivered'].includes(order.status) ? 'bg-blue-500' : 'bg-gray-200'}`}>
                                          <Truck className={`h-3 w-3 ${['shipped', 'delivered'].includes(order.status) ? 'text-white' : 'text-gray-400'}`} />
                                        </div>
                                        <div className={`w-0.5 h-4 ${order.status === 'delivered' ? 'bg-green-500' : 'bg-gray-200'}`} />
                                        <div className={`h-6 w-6 rounded-full flex items-center justify-center ${order.status === 'delivered' ? 'bg-green-500' : 'bg-gray-200'}`}>
                                          <Package className={`h-3 w-3 ${order.status === 'delivered' ? 'text-white' : 'text-gray-400'}`} />
                                        </div>
                                      </div>
                                      <div className="flex flex-col gap-3">
                                        <div>
                                          <p className={`text-xs font-medium ${order.status !== 'pending' ? 'text-green-700' : 'text-gray-400'}`}>注文確認</p>
                                          <p className="text-xs text-muted-foreground">{format(new Date(order.createdAt), "M/d HH:mm")}</p>
                                        </div>
                                        <div>
                                          <p className={`text-xs font-medium ${['shipped', 'delivered'].includes(order.status) ? 'text-blue-700' : 'text-gray-400'}`}>発送済み</p>
                                          {order.shippedAt && <p className="text-xs text-muted-foreground">{format(new Date(order.shippedAt), "M/d HH:mm")}</p>}
                                        </div>
                                        <div>
                                          <p className={`text-xs font-medium ${order.status === 'delivered' ? 'text-green-700' : 'text-gray-400'}`}>お届け済み</p>
                                          {order.deliveredAt && <p className="text-xs text-muted-foreground">{format(new Date(order.deliveredAt), "M/d HH:mm")}</p>}
                                        </div>
                                      </div>
                                    </div>
                                    {/* 配送業者・追跡番号 */}
                                    {(order.shippingCarrier || order.trackingNumber) && (
                                      <div className="border-t pt-2 mt-2 space-y-1">
                                        {order.shippingCarrier && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">配送業者</span>
                                            <span>{order.shippingCarrier}</span>
                                          </div>
                                        )}
                                        {order.trackingNumber && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">追跡番号</span>
                                            <span className="font-mono text-xs">{order.trackingNumber}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* 注文情報 */}
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
                                  <div className="flex justify-between font-medium">
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
                    <p>注文履歴がありません</p>
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
