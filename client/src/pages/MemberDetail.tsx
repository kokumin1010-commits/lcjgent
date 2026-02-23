import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Users, Mail, Calendar, Coins, UserCheck, UserX,
  Receipt, ArrowUpCircle, ArrowDownCircle, Clock, CheckCircle, XCircle, AlertCircle,
  Plus, Minus, ArrowLeft, ShoppingBag, Package, CreditCard, Truck, Phone, MapPin,
  ChevronDown, ChevronUp, Copy, Hash, Wallet, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Label } from "@/components/ui/label";
import { useLocation, useParams } from "wouter";

type OrderStatus = "pending" | "paid" | "confirmed" | "shipped" | "delivered" | "cancelled" | "refunded";

const statusConfig: Record<OrderStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: "注文受付", color: "text-yellow-700", bgColor: "bg-yellow-50 border-yellow-200" },
  paid: { label: "決済完了", color: "text-emerald-700", bgColor: "bg-emerald-50 border-emerald-200" },
  confirmed: { label: "確認済み", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200" },
  shipped: { label: "発送済み", color: "text-purple-700", bgColor: "bg-purple-50 border-purple-200" },
  delivered: { label: "配達完了", color: "text-gray-700", bgColor: "bg-gray-50 border-gray-200" },
  cancelled: { label: "キャンセル", color: "text-red-700", bgColor: "bg-red-50 border-red-200" },
  refunded: { label: "返金済み", color: "text-orange-700", bgColor: "bg-orange-50 border-orange-200" },
};

export default function MemberDetail() {
  const params = useParams<{ id: string }>();
  const memberId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const [pointAmount, setPointAmount] = useState("");
  const [pointDescription, setPointDescription] = useState("");
  const [pointAction, setPointAction] = useState<"add" | "remove">("add");
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
  const utils = trpc.useUtils();

  // 会員情報取得
  const { data: member, isLoading: memberLoading } = trpc.mall.getMemberById.useQuery(
    { id: memberId },
    { enabled: memberId > 0 }
  );

  // ポイント履歴取得
  const lineUserIdStr = member?.lineUserId || (member ? `email_${member.id}` : "");
  const { data: pointHistory, isLoading: pointsLoading } = trpc.line.getMemberPointHistory.useQuery(
    { lineUserId: lineUserIdStr },
    { enabled: !!lineUserIdStr }
  );

  // レシート履歴取得
  const { data: receiptHistory, isLoading: receiptsLoading } = trpc.line.getMemberReceiptHistory.useQuery(
    { lineUserId: lineUserIdStr },
    { enabled: !!lineUserIdStr }
  );

  // 注文履歴取得
  const { data: orderHistory, isLoading: ordersLoading } = trpc.mall.getMemberOrders.useQuery(
    { lineUserId: memberId },
    { enabled: memberId > 0 }
  );

  // レシート統計取得（累計購入金額）
  const { data: receiptStats, isLoading: receiptStatsLoading } = trpc.mall.getMemberReceiptStats.useQuery(
    { lineUserId: lineUserIdStr },
    { enabled: !!lineUserIdStr }
  );

  // ポイント操作
  const adjustPointsMutation = trpc.line.adminAdjustPoints.useMutation({
    onSuccess: (data) => {
      toast.success(pointAction === "add" ? "ポイント付与完了" : "ポイント削除完了", {
        description: `残高: ${data.balanceAfter.toLocaleString()} pt`,
      });
      setPointAmount("");
      setPointDescription("");
      if (lineUserIdStr) {
        utils.line.getMemberPointHistory.invalidate({ lineUserId: lineUserIdStr });
      }
    },
    onError: (error) => {
      toast.error("エラー", { description: error.message });
    },
  });

  const toggleOrderExpand = (orderId: number) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />承認済み</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" />却下</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="h-3 w-3 mr-1" />審査中</Badge>;
      case "on_hold":
        return <Badge className="bg-orange-100 text-orange-700"><AlertCircle className="h-3 w-3 mr-1" />保留</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (memberLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-30">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => window.history.back()} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="font-semibold text-lg">会員が見つかりません</h1>
          </div>
        </div>
        <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">
          会員ID: {memberId} のデータが見つかりませんでした
        </div>
      </div>
    );
  }

  const isLineMember = member.lineUserId && !member.lineUserId.startsWith("email_");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-30">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => window.history.back()}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Users className="h-5 w-5 text-pink-500" />
          <h1 className="font-semibold text-lg">会員詳細</h1>
          <span className="text-sm text-muted-foreground">ID: {member.id}</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* ===== Profile Card ===== */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              {member.pictureUrl ? (
                <img
                  src={member.pictureUrl}
                  alt={member.displayName || ""}
                  className="h-20 w-20 rounded-full object-cover border-2 border-pink-100"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-pink-100 to-pink-50 flex items-center justify-center border-2 border-pink-100">
                  <Users className="h-10 w-10 text-pink-300" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold">{member.displayName || "未設定"}</h2>
                  {isLineMember ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <UserCheck className="h-3 w-3 mr-1" />LINE
                    </Badge>
                  ) : member.email ? (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      <Mail className="h-3 w-3 mr-1" />メール
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                      <UserX className="h-3 w-3 mr-1" />不明
                    </Badge>
                  )}
                </div>
                {member.statusMessage && (
                  <p className="text-sm text-muted-foreground mb-2 italic">「{member.statusMessage}」</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {member.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{member.email}</span>
                    </div>
                  )}
                  {member.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{member.phone}</span>
                    </div>
                  )}
                  {isLineMember && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Hash className="h-3.5 w-3.5" />
                      <span className="font-mono text-xs truncate">{member.lineUserId}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(member.lineUserId || "");
                          toast.success("LINE IDをコピーしました");
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      登録: {member.createdAt ? format(new Date(member.createdAt), "yyyy/MM/dd HH:mm", { locale: ja }) : "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ===== Summary Stats ===== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Wallet className="h-5 w-5 mx-auto mb-1 text-orange-500" />
              <p className="text-xs text-muted-foreground">累計購入金額</p>
              <p className="text-lg font-bold text-orange-600">
                {receiptStatsLoading ? "..." : `¥${(receiptStats?.totalPurchaseAmount || 0).toLocaleString()}`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Coins className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
              <p className="text-xs text-muted-foreground">現在ポイント</p>
              <p className="text-lg font-bold text-primary">
                {pointsLoading ? "..." : (pointHistory?.balance?.toLocaleString() || 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <ArrowUpCircle className="h-5 w-5 mx-auto mb-1 text-green-500" />
              <p className="text-xs text-muted-foreground">累計獲得</p>
              <p className="text-lg font-bold text-green-600">
                {pointsLoading ? "..." : `+${pointHistory?.lifetimeEarned?.toLocaleString() || 0}`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <ArrowDownCircle className="h-5 w-5 mx-auto mb-1 text-red-500" />
              <p className="text-xs text-muted-foreground">累計使用</p>
              <p className="text-lg font-bold text-red-600">
                {pointsLoading ? "..." : `-${pointHistory?.lifetimeUsed?.toLocaleString() || 0}`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <ShoppingBag className="h-5 w-5 mx-auto mb-1 text-pink-500" />
              <p className="text-xs text-muted-foreground">注文数</p>
              <p className="text-lg font-bold">
                {ordersLoading ? "..." : (orderHistory?.length || 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Receipt className="h-5 w-5 mx-auto mb-1 text-blue-500" />
              <p className="text-xs text-muted-foreground">レシート申請</p>
              <p className="text-lg font-bold">
                {receiptsLoading ? "..." : (receiptHistory?.length || 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ===== 基本情報セクション ===== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-pink-500" />
              基本情報
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid grid-cols-3 gap-2 items-center">
                <Label className="text-muted-foreground">会員ID</Label>
                <div className="col-span-2 font-mono">{member.id}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <Label className="text-muted-foreground">表示名</Label>
                <div className="col-span-2 font-medium">{member.displayName || "-"}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <Label className="text-muted-foreground">メールアドレス</Label>
                <div className="col-span-2">{member.email || "-"}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <Label className="text-muted-foreground">電話番号</Label>
                <div className="col-span-2">{member.phone || "-"}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <Label className="text-muted-foreground">LINE ID</Label>
                <div className="col-span-2 font-mono text-sm">
                  {isLineMember ? member.lineUserId : "-"}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <Label className="text-muted-foreground">ステータスメッセージ</Label>
                <div className="col-span-2">{member.statusMessage || "-"}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <Label className="text-muted-foreground">ユーザータイプ</Label>
                <div className="col-span-2">
                  <Badge variant="outline">{member.userType || "unknown"}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <Label className="text-muted-foreground">ブロック状態</Label>
                <div className="col-span-2">
                  {member.isBlocked ? (
                    <Badge className="bg-red-100 text-red-700">ブロック中</Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-700">正常</Badge>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <Label className="text-muted-foreground">登録日時</Label>
                <div className="col-span-2">
                  {member.createdAt ? format(new Date(member.createdAt), "yyyy年MM月dd日 HH:mm", { locale: ja }) : "-"}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <Label className="text-muted-foreground">最終更新</Label>
                <div className="col-span-2">
                  {member.updatedAt ? format(new Date(member.updatedAt), "yyyy年MM月dd日 HH:mm", { locale: ja }) : "-"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ===== 保存済み住所セクション ===== */}
        <MemberAddressesCard memberId={memberId} />

        {/* ===== ポイントセクション ===== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="h-4 w-4 text-yellow-500" />
              ポイント
            </CardTitle>
            <CardDescription>現在のポイント残高と履歴</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Point Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-sm text-muted-foreground">現在のポイント</p>
                <p className="text-2xl font-bold text-primary">
                  {pointsLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (pointHistory?.balance?.toLocaleString() || 0)}
                </p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-sm text-muted-foreground">累計獲得</p>
                <p className="text-xl font-semibold text-green-600">
                  +{pointHistory?.lifetimeEarned?.toLocaleString() || 0}
                </p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-sm text-muted-foreground">累計使用</p>
                <p className="text-xl font-semibold text-red-600">
                  -{pointHistory?.lifetimeUsed?.toLocaleString() || 0}
                </p>
              </div>
            </div>

            {/* ポイント操作 */}
            <div className="border border-dashed rounded-lg p-4">
              <h4 className="font-medium mb-3">ポイント操作</h4>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Select value={pointAction} onValueChange={(v: "add" | "remove") => setPointAction(v)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add">付与</SelectItem>
                      <SelectItem value="remove">削除</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="ポイント数"
                    value={pointAmount}
                    onChange={(e) => setPointAmount(e.target.value)}
                    className="w-[120px]"
                    min={1}
                  />
                </div>
                <Textarea
                  placeholder="理由を入力（例: キャンペーン特典、不具合補償等）"
                  value={pointDescription}
                  onChange={(e) => setPointDescription(e.target.value)}
                  rows={2}
                />
                <Button
                  onClick={() => {
                    const amount = parseInt(pointAmount);
                    if (!amount || amount <= 0) {
                      toast.error("ポイント数を正しく入力してください");
                      return;
                    }
                    if (!pointDescription.trim()) {
                      toast.error("理由を入力してください");
                      return;
                    }
                    adjustPointsMutation.mutate({
                      lineUserId: lineUserIdStr,
                      amount: pointAction === "add" ? amount : -amount,
                      description: pointDescription,
                    });
                  }}
                  disabled={adjustPointsMutation.isPending}
                  className={pointAction === "add" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
                >
                  {adjustPointsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : pointAction === "add" ? (
                    <Plus className="h-4 w-4 mr-2" />
                  ) : (
                    <Minus className="h-4 w-4 mr-2" />
                  )}
                  {pointAction === "add" ? "ポイントを付与" : "ポイントを削除"}
                </Button>
              </div>
            </div>

            {/* Transaction History */}
            <div>
              <h4 className="font-medium mb-3">ポイント履歴 ({pointHistory?.transactions?.length || 0}件)</h4>
              {pointsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : pointHistory?.transactions && pointHistory.transactions.length > 0 ? (
                <div className="divide-y border rounded-lg">
                  {pointHistory.transactions.map((tx: any, index: number) => (
                    <div key={index} className="py-3 px-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {tx.type === "earn" ? (
                          <ArrowUpCircle className="h-5 w-5 text-green-500 shrink-0" />
                        ) : (
                          <ArrowDownCircle className="h-5 w-5 text-red-500 shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{tx.description || (tx.type === "earn" ? "ポイント獲得" : "ポイント使用")}</p>
                          <p className="text-xs text-muted-foreground">
                            {tx.createdAt ? format(new Date(tx.createdAt), "yyyy/MM/dd HH:mm", { locale: ja }) : "-"}
                          </p>
                        </div>
                      </div>
                      <div className={`font-semibold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount?.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8 border rounded-lg">
                  ポイント履歴がありません
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ===== 注文履歴セクション ===== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-pink-500" />
              注文履歴
            </CardTitle>
            <CardDescription>{orderHistory?.length || 0}件の注文</CardDescription>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : orderHistory && orderHistory.length > 0 ? (
              <div className="space-y-3">
                {orderHistory.map((order: any) => {
                  const status = statusConfig[order.status as OrderStatus] || statusConfig.pending;
                  const isExpanded = expandedOrders.has(order.id);
                  return (
                    <div key={order.id} className={`border rounded-lg overflow-hidden ${status.bgColor}`}>
                      <button
                        onClick={() => toggleOrderExpand(order.id)}
                        className="w-full p-4 text-left"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium">#{order.orderNumber || order.id}</span>
                            <Badge className={`${status.bgColor} ${status.color} border`}>
                              {status.label}
                            </Badge>
                          </div>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {order.createdAt ? format(new Date(order.createdAt), "yyyy/MM/dd HH:mm", { locale: ja }) : "-"}
                          </span>
                          <span className="font-bold">¥{order.totalAmount?.toLocaleString() || 0}</span>
                        </div>
                        {order.paymentMethod && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <CreditCard className="h-3 w-3" />
                            <span>
                              {order.paymentMethod === "stripe" ? "カード決済" :
                               order.paymentMethod === "points" ? "ポイント決済" :
                               order.paymentMethod === "cod" ? "代引き" : order.paymentMethod}
                            </span>
                            {order.pointsUsed > 0 && (
                              <span className="ml-2 text-pink-600">(-{order.pointsUsed?.toLocaleString()}pt使用)</span>
                            )}
                          </div>
                        )}
                      </button>
                      {isExpanded && order.items && (
                        <div className="border-t bg-white/50 p-4 space-y-3">
                          {/* 配送先 */}
                          {order.shippingName && (
                            <div className="text-sm space-y-1">
                              <div className="flex items-center gap-1 font-medium">
                                <MapPin className="h-3.5 w-3.5" />
                                配送先
                              </div>
                              <p className="text-muted-foreground pl-5">
                                {order.shippingName} 〒{order.shippingPostalCode}<br />
                                {order.shippingAddress}
                                {order.shippingPhone && <><br />{order.shippingPhone}</>}
                              </p>
                            </div>
                          )}
                          {/* 商品一覧 */}
                          <div className="text-sm">
                            <div className="flex items-center gap-1 font-medium mb-2">
                              <Package className="h-3.5 w-3.5" />
                              商品一覧
                            </div>
                            <div className="space-y-2">
                              {order.items.map((item: any, idx: number) => {
                                const imgUrl = item.productImageUrl || (item.productImageUrls ? JSON.parse(item.productImageUrls)?.[0] : null);
                                return (
                                  <div key={idx} className="flex items-center gap-3 pl-5">
                                    {imgUrl ? (
                                      <img src={imgUrl} alt="" className="h-10 w-10 rounded object-cover border" />
                                    ) : (
                                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                                        <Package className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm truncate">{item.productName || "商品"}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {item.variantName && <span>{item.variantName} / </span>}
                                        数量: {item.quantity} × ¥{item.unitPrice?.toLocaleString()}
                                      </p>
                                    </div>
                                    <span className="font-medium">¥{(item.quantity * item.unitPrice)?.toLocaleString()}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          {/* 追跡情報 */}
                          {order.trackingNumber && (
                            <div className="text-sm">
                              <div className="flex items-center gap-1 font-medium">
                                <Truck className="h-3.5 w-3.5" />
                                追跡番号: <span className="font-mono">{order.trackingNumber}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                注文履歴がありません
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===== レシート履歴セクション ===== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-blue-500" />
              レシート申請履歴
            </CardTitle>
            <CardDescription>
              {receiptHistory?.length || 0}件の申請
              {receiptStats && ` / 承認: ${receiptStats.approvedReceipts}件`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Receipt Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">申請件数</p>
                <p className="text-xl font-bold">{receiptStats?.totalReceipts || 0}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">承認済み</p>
                <p className="text-xl font-bold text-green-600">{receiptStats?.approvedReceipts || 0}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">累計購入金額</p>
                <p className="text-xl font-bold text-orange-600">¥{(receiptStats?.totalPurchaseAmount || 0).toLocaleString()}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">獲得ポイント</p>
                <p className="text-xl font-bold text-primary">{(receiptStats?.totalPointsAwarded || 0).toLocaleString()}</p>
              </div>
            </div>

            {/* Receipt List */}
            {receiptsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : receiptHistory && receiptHistory.length > 0 ? (
              <div className="divide-y border rounded-lg">
                {receiptHistory.map((receipt: any, index: number) => (
                  <div key={index} className="py-3 px-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{receipt.storeName || "店舗名不明"}</span>
                      </div>
                      {getStatusBadge(receipt.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div>
                        <span>金額: </span>
                        <span className="font-medium text-foreground">¥{receipt.totalAmount?.toLocaleString() || 0}</span>
                      </div>
                      <div>
                        <span>ポイント: </span>
                        <span className="font-medium text-primary">{receipt.pointsAwarded?.toLocaleString() || 0}pt</span>
                      </div>
                      <div>
                        <span>購入日: </span>
                        <span>{receipt.purchaseDate ? format(new Date(receipt.purchaseDate), "yyyy/MM/dd", { locale: ja }) : "-"}</span>
                      </div>
                      <div>
                        <span>申請日: </span>
                        <span>{receipt.submittedAt ? format(new Date(receipt.submittedAt), "yyyy/MM/dd", { locale: ja }) : "-"}</span>
                      </div>
                    </div>
                    {receipt.imageUrl && (
                      <div className="mt-2">
                        <a
                          href={receipt.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          レシート画像を表示
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8 border rounded-lg">
                レシート申請履歴がありません
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ===== 管理者用: 会員の保存済み住所一覧 =====
function MemberAddressesCard({ memberId }: { memberId: number }) {
  const { data: addresses, isLoading } = trpc.mall.getMemberAddresses.useQuery(
    { lineUserId: memberId },
    { enabled: memberId > 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4 text-pink-500" />
          保存済み住所
        </CardTitle>
        <CardDescription>会員が登録している配送先住所</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-pink-500" />
          </div>
        ) : !addresses || addresses.length === 0 ? (
          <div className="text-center text-muted-foreground py-6 border rounded-lg">
            <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">保存済み住所がありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr: any) => (
              <div
                key={addr.id}
                className={`border rounded-lg p-3 ${
                  addr.isDefault ? "border-pink-300 bg-pink-50/50" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={addr.isDefault ? "default" : "outline"} className={addr.isDefault ? "bg-pink-500 text-white text-[10px]" : "text-[10px]"}>
                        {addr.label || "住所"}
                      </Badge>
                      {addr.isDefault && (
                        <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">
                          デフォルト
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium text-sm">{addr.recipientName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      〒{addr.postalCode?.replace(/(\d{3})(\d{4})/, "$1-$2")}
                    </p>
                    <p className="text-xs">
                      {addr.prefecture}{addr.city}{addr.addressLine1}
                      {addr.addressLine2 ? ` ${addr.addressLine2}` : ""}
                    </p>
                    {addr.phoneNumber && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {addr.phoneNumber}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const fullAddr = `${addr.postalCode ? `〒${addr.postalCode.replace(/(\d{3})(\d{4})/, "$1-$2")} ` : ""}${addr.prefecture}${addr.city}${addr.addressLine1}${addr.addressLine2 ? ` ${addr.addressLine2}` : ""}`;
                      navigator.clipboard.writeText(fullAddr);
                      toast.success("住所をコピーしました");
                    }}
                    className="text-muted-foreground hover:text-foreground p-1"
                    title="住所をコピー"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
