import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Package, Truck, CheckCircle, XCircle, Clock, ShoppingBag, User, MapPin, Phone, Calendar, Coins, CreditCard, FileText, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { toast } from "sonner";

type OrderStatus = "pending" | "paid" | "confirmed" | "shipped" | "delivered" | "cancelled" | "refunded";

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: React.ReactNode; bgColor: string }> = {
  pending: { 
    label: "注文受付", 
    color: "text-yellow-700", 
    bgColor: "bg-yellow-50 border-yellow-200",
    icon: <Clock className="h-4 w-4" /> 
  },
  paid: { 
    label: "決済完了", 
    color: "text-emerald-700", 
    bgColor: "bg-emerald-50 border-emerald-200",
    icon: <CreditCard className="h-4 w-4" /> 
  },
  confirmed: { 
    label: "確認済み", 
    color: "text-blue-700", 
    bgColor: "bg-blue-50 border-blue-200",
    icon: <CheckCircle className="h-4 w-4" /> 
  },
  shipped: { 
    label: "発送済み", 
    color: "text-purple-700", 
    bgColor: "bg-purple-50 border-purple-200",
    icon: <Truck className="h-4 w-4" /> 
  },
  delivered: { 
    label: "配達完了", 
    color: "text-green-700", 
    bgColor: "bg-green-50 border-green-200",
    icon: <CheckCircle className="h-4 w-4" /> 
  },
  cancelled: { 
    label: "キャンセル", 
    color: "text-red-700", 
    bgColor: "bg-red-50 border-red-200",
    icon: <XCircle className="h-4 w-4" /> 
  },
  refunded: { 
    label: "返金済み", 
    color: "text-orange-700", 
    bgColor: "bg-orange-50 border-orange-200",
    icon: <RefreshCw className="h-4 w-4" /> 
  },
};

export default function OrderManagement() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderStatus>("pending");
  const [adminNotes, setAdminNotes] = useState("");
  const [shippingCarrier, setShippingCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  const { data: orders, isLoading, refetch } = trpc.mall.getOrders.useQuery(
    statusFilter === "all" ? undefined : { status: statusFilter }
  );

  const { data: orderDetail, isLoading: detailLoading } = trpc.mall.getOrderById.useQuery(
    { id: selectedOrderId! },
    { enabled: !!selectedOrderId }
  );

  const updateStatusMutation = trpc.mall.updateOrderStatus.useMutation({
    onSuccess: () => {
      toast.success("ステータスを更新しました");
      refetch();
      setIsStatusDialogOpen(false);
      setAdminNotes("");
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const handleViewDetail = (orderId: number) => {
    setSelectedOrderId(orderId);
    setIsDetailOpen(true);
  };

  const handleOpenStatusDialog = (orderId: number, currentStatus: OrderStatus) => {
    setSelectedOrderId(orderId);
    setNewStatus(currentStatus);
    setAdminNotes("");
    setShippingCarrier("");
    setTrackingNumber("");
    setIsStatusDialogOpen(true);
  };

  // ワンタップでステータスを次の段階に進める
  const quickStatusMutation = trpc.mall.updateOrderStatus.useMutation({
    onSuccess: () => {
      toast.success("ステータスを更新しました");
      refetch();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const getNextStatus = (current: OrderStatus): OrderStatus | null => {
    const flow: Record<string, OrderStatus> = {
      pending: "paid",
      paid: "shipped",
      shipped: "delivered",
    };
    return flow[current] || null;
  };

  const getQuickActionButton = (orderId: number, status: OrderStatus) => {
    const nextStatus = getNextStatus(status);
    if (!nextStatus) return null;

    const actionConfig: Record<OrderStatus, { label: string; icon: React.ReactNode; color: string }> = {
      paid: { label: "決済済み", icon: <CreditCard className="h-3.5 w-3.5" />, color: "bg-emerald-500 hover:bg-emerald-600 text-white" },
      confirmed: { label: "確認済み", icon: <CheckCircle className="h-3.5 w-3.5" />, color: "bg-blue-500 hover:bg-blue-600 text-white" },
      shipped: { label: "発送済み", icon: <Truck className="h-3.5 w-3.5" />, color: "bg-purple-500 hover:bg-purple-600 text-white" },
      delivered: { label: "配達完了", icon: <CheckCircle className="h-3.5 w-3.5" />, color: "bg-green-500 hover:bg-green-600 text-white" },
      pending: { label: "", icon: null, color: "" },
      cancelled: { label: "", icon: null, color: "" },
      refunded: { label: "", icon: null, color: "" },
    };

    const config = actionConfig[nextStatus];
    if (!config.label) return null;

    // 発送済みにする場合は配送情報（伝票番号）が必要なのでダイアログを開く
    if (nextStatus === "shipped") {
      return (
        <Button
          size="sm"
          className={`gap-1.5 ${config.color}`}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedOrderId(orderId);
            setNewStatus("shipped");
            setAdminNotes("");
            setShippingCarrier("");
            setTrackingNumber("");
            setIsStatusDialogOpen(true);
          }}
        >
          <Truck className="h-3.5 w-3.5" />
          発送処理
        </Button>
      );
    }

    return (
      <Button
        size="sm"
        className={`gap-1.5 ${config.color}`}
        disabled={quickStatusMutation.isPending}
        onClick={(e) => {
          e.stopPropagation();
          quickStatusMutation.mutate({ id: orderId, status: nextStatus });
        }}
      >
        {quickStatusMutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          config.icon
        )}
        {config.label}にする
      </Button>
    );
  };

  const handleUpdateStatus = () => {
    if (!selectedOrderId) return;
    updateStatusMutation.mutate({
      id: selectedOrderId,
      status: newStatus,
      adminNotes: adminNotes || undefined,
      shippingCarrier: shippingCarrier || undefined,
      trackingNumber: trackingNumber || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status as OrderStatus];
    if (!config) {
      return (
        <Badge variant="outline" className="text-gray-700 bg-gray-50 border-gray-200 gap-1">
          <Clock className="h-4 w-4" />
          {status}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className={`${config.color} ${config.bgColor} gap-1`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  // 統計情報
  const stats = {
    total: orders?.length || 0,
    pending: orders?.filter(o => o.order.status === "pending").length || 0,
    paid: orders?.filter(o => o.order.status === "paid").length || 0,
    confirmed: orders?.filter(o => o.order.status === "confirmed").length || 0,
    shipped: orders?.filter(o => o.order.status === "shipped").length || 0,
    delivered: orders?.filter(o => o.order.status === "delivered").length || 0,
    cancelled: orders?.filter(o => o.order.status === "cancelled").length || 0,
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-rose-500" />
            注文管理
          </h1>
          <p className="text-muted-foreground">注文の確認とステータス管理</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          更新
        </Button>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("all")}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">全注文</div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${statusFilter === "pending" ? "ring-2 ring-yellow-500" : ""}`} onClick={() => setStatusFilter("pending")}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-sm text-muted-foreground">注文受付</div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${statusFilter === "paid" ? "ring-2 ring-emerald-500" : ""}`} onClick={() => setStatusFilter("paid")}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-emerald-600">{stats.paid}</div>
            <div className="text-sm text-muted-foreground">決済完了</div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${statusFilter === "confirmed" ? "ring-2 ring-blue-500" : ""}`} onClick={() => setStatusFilter("confirmed")}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.confirmed}</div>
            <div className="text-sm text-muted-foreground">確認済み</div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${statusFilter === "shipped" ? "ring-2 ring-purple-500" : ""}`} onClick={() => setStatusFilter("shipped")}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">{stats.shipped}</div>
            <div className="text-sm text-muted-foreground">発送済み</div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${statusFilter === "delivered" ? "ring-2 ring-green-500" : ""}`} onClick={() => setStatusFilter("delivered")}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
            <div className="text-sm text-muted-foreground">配達完了</div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${statusFilter === "cancelled" ? "ring-2 ring-red-500" : ""}`} onClick={() => setStatusFilter("cancelled")}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
            <div className="text-sm text-muted-foreground">キャンセル</div>
          </CardContent>
        </Card>
      </div>

      {/* フィルター */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="ステータスで絞り込み" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="pending">注文受付</SelectItem>
            <SelectItem value="paid">決済完了</SelectItem>
            <SelectItem value="confirmed">確認済み</SelectItem>
            <SelectItem value="shipped">発送済み</SelectItem>
            <SelectItem value="delivered">配達完了</SelectItem>
            <SelectItem value="cancelled">キャンセル</SelectItem>
          </SelectContent>
        </Select>
        {statusFilter !== "all" && (
          <Button variant="ghost" size="sm" onClick={() => setStatusFilter("all")}>
            フィルターをクリア
          </Button>
        )}
      </div>

      {/* 注文一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>注文一覧</CardTitle>
          <CardDescription>
            {statusFilter === "all" ? "すべての注文" : `${statusConfig[statusFilter].label}の注文`}
            （{orders?.length || 0}件）
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
            </div>
          ) : orders && orders.length > 0 ? (
            <div className="space-y-4">
              {orders.map((item) => (
                <div
                  key={item.order.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                          #{item.order.orderNumber}
                        </span>
                        {getStatusBadge(item.order.status as OrderStatus)}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <User className="h-4 w-4" />
                          {item.lineUser?.displayName || "不明"}
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(item.order.createdAt), "yyyy/MM/dd HH:mm", { locale: ja })}
                        </div>
                        <div className="flex items-center gap-1">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">¥{item.order.totalAmount.toLocaleString()}</span>
                        </div>
                        {item.order.pointsUsed > 0 && (
                          <div className="flex items-center gap-1">
                            <Coins className="h-4 w-4 text-rose-500" />
                            <span className="text-rose-600">{item.order.pointsUsed.toLocaleString()} pt</span>
                          </div>
                        )}
                      </div>
                      {/* 配送先住所 */}
                      {(item.order.shippingName || item.order.shippingAddress) && (
                        <div className="mt-2 pt-2 border-t border-dashed border-gray-200 text-sm text-muted-foreground">
                          <div className="flex items-start gap-1">
                            <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-rose-400" />
                            <div className="space-y-0.5">
                              {item.order.shippingName && (
                                <span className="font-medium text-foreground">{item.order.shippingName}</span>
                              )}
                              {item.order.shippingPhone && (
                                <span className="ml-2">
                                  <Phone className="h-3 w-3 inline mr-0.5" />
                                  {item.order.shippingPhone}
                                </span>
                              )}
                              {item.order.shippingPostalCode && (
                                <p className="text-xs">〒{item.order.shippingPostalCode}</p>
                              )}
                              {item.order.shippingAddress && (
                                <p className="text-xs">{item.order.shippingAddress}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {getQuickActionButton(item.order.id, item.order.status as OrderStatus)}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetail(item.order.id)}
                      >
                        詳細
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => handleOpenStatusDialog(item.order.id, item.order.status as OrderStatus)}
                      >
                        その他
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>注文がありません</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 注文詳細ダイアログ */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              注文詳細
            </DialogTitle>
            {orderDetail && (
              <DialogDescription>
                注文番号: #{orderDetail.order.orderNumber}
              </DialogDescription>
            )}
          </DialogHeader>
          
          {detailLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : orderDetail ? (
            <div className="space-y-6">
              {/* ステータス */}
              <div className="flex items-center justify-between">
                {getStatusBadge(orderDetail.order.status as OrderStatus)}
                <span className="text-sm text-muted-foreground">
                  {format(new Date(orderDetail.order.createdAt), "yyyy年M月d日 HH:mm", { locale: ja })}
                </span>
              </div>

              {/* 購入者情報 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    購入者情報
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p><strong>名前:</strong> {orderDetail.lineUser?.displayName || "不明"}</p>
                  {orderDetail.order.shippingName && (
                    <p><strong>配送先名:</strong> {orderDetail.order.shippingName}</p>
                  )}
                  {orderDetail.order.shippingPhone && (
                    <p className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {orderDetail.order.shippingPhone}
                    </p>
                  )}
                  {orderDetail.order.shippingAddress && (
                    <p className="flex items-start gap-1">
                      <MapPin className="h-3 w-3 mt-1" />
                      〒{orderDetail.order.shippingPostalCode} {orderDetail.order.shippingAddress}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* 注文商品 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    注文商品
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {orderDetail.items.map((item) => (
                      <div key={item.id} className="flex justify-between items-center py-2 border-b last:border-0">
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-sm text-muted-foreground">
                            ¥{item.productPrice.toLocaleString()} × {item.quantity}
                          </p>
                        </div>
                        <p className="font-medium">¥{item.subtotal.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 支払い情報 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    支払い情報
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span>商品合計</span>
                    <span>¥{orderDetail.order.totalAmount.toLocaleString()}</span>
                  </div>
                  {orderDetail.order.pointsUsed > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span className="flex items-center gap-1">
                        <Coins className="h-3 w-3" />
                        ポイント利用
                      </span>
                      <span>-{orderDetail.order.pointsUsed.toLocaleString()} pt</span>
                    </div>
                  )}
                  {orderDetail.order.cashAmount > 0 && (
                    <div className="flex justify-between">
                      <span>現金支払い</span>
                      <span>¥{orderDetail.order.cashAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-2 border-t">
                    <span>合計</span>
                    <span>¥{orderDetail.order.totalAmount.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>

              {/* メモ */}
              {(orderDetail.order.notes || orderDetail.order.adminNotes) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      メモ
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    {orderDetail.order.notes && (
                      <div>
                        <p className="text-muted-foreground">お客様メモ:</p>
                        <p>{orderDetail.order.notes}</p>
                      </div>
                    )}
                    {orderDetail.order.adminNotes && (
                      <div>
                        <p className="text-muted-foreground">管理者メモ:</p>
                        <p>{orderDetail.order.adminNotes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* キャンセル情報 */}
              {orderDetail.order.status === 'cancelled' && (
                <Card className="border-red-200 bg-red-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                      <XCircle className="h-4 w-4" />
                      キャンセル情報
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    {(orderDetail.order as any).cancelledAt && (
                      <p><strong>キャンセル日時:</strong> {format(new Date((orderDetail.order as any).cancelledAt), "yyyy/MM/dd HH:mm:ss", { locale: ja })}</p>
                    )}
                    {(orderDetail.order as any).cancelReason && (
                      <p><strong>キャンセル理由:</strong> {(orderDetail.order as any).cancelReason}</p>
                    )}
                    {orderDetail.order.pointsUsed > 0 && (
                      <p className="text-green-700"><strong>返還ポイント:</strong> {orderDetail.order.pointsUsed.toLocaleString()} pt</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* タイムスタンプ */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>注文日時: {format(new Date(orderDetail.order.createdAt), "yyyy/MM/dd HH:mm:ss", { locale: ja })}</p>
                {orderDetail.order.shippedAt && (
                  <p>発送日時: {format(new Date(orderDetail.order.shippedAt), "yyyy/MM/dd HH:mm:ss", { locale: ja })}</p>
                )}
                {orderDetail.order.deliveredAt && (
                  <p>配達完了: {format(new Date(orderDetail.order.deliveredAt), "yyyy/MM/dd HH:mm:ss", { locale: ja })}</p>
                )}
                {(orderDetail.order as any).cancelledAt && (
                  <p>キャンセル日時: {format(new Date((orderDetail.order as any).cancelledAt), "yyyy/MM/dd HH:mm:ss", { locale: ja })}</p>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ステータス変更ダイアログ */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {newStatus === 'shipped' ? (
                <><Truck className="h-5 w-5 text-purple-500" /> 発送処理</>
              ) : (
                'ステータス変更'
              )}
            </DialogTitle>
            <DialogDescription>
              {newStatus === 'shipped' 
                ? '配送業者と伝票番号を入力して発送済みにします' 
                : '注文のステータスを変更します'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">新しいステータス</label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as OrderStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      注文受付
                    </span>
                  </SelectItem>
                  <SelectItem value="paid">
                    <span className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-emerald-600" />
                      決済完了
                    </span>
                  </SelectItem>
                  <SelectItem value="confirmed">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                      確認済み
                    </span>
                  </SelectItem>
                  <SelectItem value="shipped">
                    <span className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-purple-600" />
                      発送済み
                    </span>
                  </SelectItem>
                  <SelectItem value="delivered">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      配達完了
                    </span>
                  </SelectItem>
                  <SelectItem value="cancelled">
                    <span className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      キャンセル
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 配送情報（発送済みまたは配達完了時に表示） */}
            {(newStatus === 'shipped' || newStatus === 'delivered') && (
              <div className="space-y-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm font-medium text-purple-700 flex items-center gap-1">
                  <Truck className="h-4 w-4" />
                  発送情報
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-medium">配送業者 <span className="text-red-500">*</span></label>
                  <Select value={shippingCarrier} onValueChange={setShippingCarrier}>
                    <SelectTrigger>
                      <SelectValue placeholder="配送業者を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ヤマト運輸">ヤマト運輸</SelectItem>
                      <SelectItem value="佐川急便">佐川急便</SelectItem>
                      <SelectItem value="日本郵便">日本郵便</SelectItem>
                      <SelectItem value="西濃運輸">西濃運輸</SelectItem>
                      <SelectItem value="その他">その他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">伝票番号（追跡番号） <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                    placeholder="伝票番号を入力..."
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">配送業者から発行された伝票番号を入力してください</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">管理者メモ（任意）</label>
              <Textarea
                placeholder="メモを入力..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>
              キャンセル
            </Button>
            <Button 
              onClick={handleUpdateStatus}
              disabled={updateStatusMutation.isPending || (newStatus === 'shipped' && (!shippingCarrier || !trackingNumber))}
              className={newStatus === 'shipped' ? "bg-purple-500 hover:bg-purple-600" : "bg-rose-500 hover:bg-rose-600"}
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : newStatus === 'shipped' ? (
                <Truck className="h-4 w-4 mr-2" />
              ) : null}
              {newStatus === 'shipped' ? '発送済みにする' : '更新'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
