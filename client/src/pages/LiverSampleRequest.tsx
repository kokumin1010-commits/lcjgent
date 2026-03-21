import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getLiverToken } from "@/lib/liverAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  Package,
  Calendar,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  HelpCircle,
  Info,
  CreditCard,
  Star,
  Award,
  TrendingUp,
  Truck,
  ShoppingBag,
} from "lucide-react";

// Types
interface SampleItem {
  mallProductId: number | null;
  productName: string;
  price: number;
  quantity: number;
}

type ActiveView = "list" | "create" | "detail";

const RANK_CONFIG = {
  none: { label: "ランクなし", color: "bg-gray-600", icon: null, textColor: "text-gray-400" },
  silver: { label: "SILVER", color: "bg-gradient-to-r from-gray-300 to-gray-400", icon: "🥈", textColor: "text-gray-300" },
  gold: { label: "GOLD", color: "bg-gradient-to-r from-yellow-500 to-amber-400", icon: "🥇", textColor: "text-yellow-400" },
  black: { label: "BLACK", color: "bg-gradient-to-r from-gray-900 to-black border border-purple-500", icon: "🖤", textColor: "text-purple-400" },
};

export default function LiverSampleRequest() {
  const [, navigate] = useLocation();
  const token = getLiverToken();
  const [activeView, setActiveView] = useState<ActiveView>("list");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  // Use liver.me to check authentication (supports both JWT header and cookie)
  const meQuery = trpc.liver.me.useQuery(undefined, {
    retry: false,
    staleTime: 30000,
  });
  const isAuthenticated = !!token || !!meQuery.data;
  const isCheckingAuth = meQuery.isLoading;

  // Create form state
  const [scheduledDate, setScheduledDate] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [memo, setMemo] = useState("");
  const [items, setItems] = useState<SampleItem[]>([]);

  // Search dialog
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // How to dialog
  const [howToOpen, setHowToOpen] = useState(false);

  // Rank detail dialog
  const [rankDetailOpen, setRankDetailOpen] = useState(false);

  // Error/success
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // API calls - use ctx-based auth (token is optional fallback)
  const creditQuery = trpc.sampleRequest.getMyCredit.useQuery(
    { token: token || undefined },
    { enabled: isAuthenticated }
  );

  const requestsQuery = trpc.sampleRequest.getMyRequests.useQuery(
    { token: token || undefined },
    { enabled: isAuthenticated }
  );

  const searchProductsQuery = trpc.sampleRequest.searchProducts.useQuery(
    { token: token || undefined, query: searchQuery },
    { enabled: isAuthenticated && searchQuery.length >= 1 }
  );

  const savedAddressQuery = trpc.sampleRequest.getSavedAddress.useQuery(
    { token: token || undefined },
    { enabled: isAuthenticated }
  );

  const createMutation = trpc.sampleRequest.create.useMutation({
    onSuccess: (data) => {
      setSuccess("サンプル請求を送信しました！運営の承認をお待ちください。");
      setActiveView("list");
      resetForm();
      requestsQuery.refetch();
      creditQuery.refetch();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const credit = creditQuery.data;
  const requests = requestsQuery.data || [];

  // Total amount calculation
  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [items]);

  // Credit usage calculation
  const creditUsed = useMemo(() => {
    if (!credit) return 0;
    return Math.min(totalAmount, Number(credit.remainingCredit));
  }, [totalAmount, credit]);

  const outOfPocket = useMemo(() => {
    if (!credit) return 0;
    const excess = totalAmount - Number(credit.remainingCredit);
    if (excess <= 0) return 0;
    return Math.round(excess * 0.4); // 60% OFF
  }, [totalAmount, credit]);

  function resetForm() {
    setScheduledDate("");
    setPostalCode("");
    setAddress("");
    setPhone("");
    setMemo("");
    setItems([]);
    setError("");
  }

  function startCreate() {
    resetForm();
    // 保存済み住所を自動入力
    if (savedAddressQuery.data) {
      setPostalCode(savedAddressQuery.data.postalCode || "");
      setAddress(savedAddressQuery.data.address || "");
      setPhone(savedAddressQuery.data.phone || "");
    }
    setActiveView("create");
    setHowToOpen(true);
  }

  function addProduct(product: { id: number; name: string; regularPrice: number }) {
    setItems(prev => [...prev, {
      mallProductId: product.id,
      productName: product.name,
      price: product.regularPrice,
      quantity: 1,
    }]);
    setSearchOpen(false);
    setSearchQuery("");
  }

  function addCustomItem() {
    setItems(prev => [...prev, {
      mallProductId: null,
      productName: "",
      price: 0,
      quantity: 1,
    }]);
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof SampleItem, value: any) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  function handleSubmit() {
    setError("");
    if (!scheduledDate) { setError("配信予定日を入力してください"); return; }
    if (!address) { setError("配送先住所を入力してください"); return; }
    if (items.length === 0) { setError("商品を1つ以上追加してください"); return; }
    if (items.some(i => !i.productName)) { setError("商品名を入力してください"); return; }

    createMutation.mutate({
      token: token || undefined,
      scheduledDate,
      postalCode: postalCode || undefined,
      address: address || undefined,
      phone: phone || undefined,
      memo: memo || undefined,
      items: items.map(i => ({
        mallProductId: i.mallProductId,
        productName: i.productName,
        price: i.price,
        quantity: i.quantity,
      })),
    });
  }

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: "審査待ち", color: "bg-yellow-600", icon: Clock },
    approved: { label: "承認済み", color: "bg-green-600", icon: CheckCircle },
    rejected: { label: "却下", color: "bg-red-600", icon: XCircle },
    shipped: { label: "発送済み", color: "bg-blue-600", icon: Truck },
    cancelled: { label: "キャンセル", color: "bg-gray-600", icon: XCircle },
  };

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  // If not authenticated via token or cookie, redirect to login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center flex-col gap-4">
        <p>ログインが必要です</p>
        <button
          onClick={() => navigate("/liver/login")}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
        >
          ログインページへ
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => {
            if (activeView === "list") navigate("/liver");
            else setActiveView("list");
          }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-purple-400" />
            サンプル請求
          </h1>
        </div>

        {/* Success message */}
        {success && (
          <div className="bg-green-900/50 border border-green-700 rounded-lg p-3 text-green-300 text-sm flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            {success}
            <button onClick={() => setSuccess("")} className="ml-auto text-green-400">×</button>
          </div>
        )}

        {/* ============ CREDIT CARD ============ */}
        {credit && (
          <Card className={`border-0 ${credit.rank !== "none" ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-purple-500/30" : "bg-gray-900 border-gray-800"}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-purple-400" />
                  <span className="text-sm text-gray-400">今月のクレジット</span>
                </div>
                <div className="flex items-center gap-1">
                  {credit.rank !== "none" && (
                    <Badge className={`${RANK_CONFIG[credit.rank as keyof typeof RANK_CONFIG]?.color} text-white text-xs px-3`}>
                      {RANK_CONFIG[credit.rank as keyof typeof RANK_CONFIG]?.icon} {RANK_CONFIG[credit.rank as keyof typeof RANK_CONFIG]?.label}
                    </Badge>
                  )}
                  <button
                    onClick={() => setRankDetailOpen(true)}
                    className="bg-gray-700 hover:bg-gray-600 rounded-full w-5 h-5 flex items-center justify-center transition-colors"
                  >
                    <HelpCircle className="h-3 w-3 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Credit Balance - Big Number */}
              <div className="text-center my-4">
                <div className="text-4xl font-bold text-white">
                  ¥{Number(credit.remainingCredit).toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">残りクレジット</div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all"
                  style={{ width: `${credit.totalCredit > 0 ? Math.min(100, (Number(credit.usedCredit) / Number(credit.totalCredit)) * 100) : 0}%` }}
                />
              </div>

              {/* Credit Breakdown */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="text-gray-500">合計</div>
                  <div className="text-white font-semibold">¥{Number(credit.totalCredit).toLocaleString()}</div>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="text-gray-500">使用済み</div>
                  <div className="text-orange-400 font-semibold">¥{Number(credit.usedCredit).toLocaleString()}</div>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="text-gray-500">残り</div>
                  <div className="text-green-400 font-semibold">¥{Number(credit.remainingCredit).toLocaleString()}</div>
                </div>
              </div>

              {/* Rank Progress */}
              {credit.rank === "none" && (
                <div className="mt-3 bg-gray-800/50 rounded p-2 text-xs text-gray-400">
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingUp className="h-3 w-3" />
                    <span>SILVERまで: 配信{Math.max(0, 10 - Number(credit.streamingHours))}h / 売上¥{Math.max(0, 500000 - Number(credit.monthlySales)).toLocaleString()}</span>
                  </div>
                </div>
              )}
              {credit.rank === "silver" && (
                <div className="mt-3 bg-gray-800/50 rounded p-2 text-xs text-gray-400">
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingUp className="h-3 w-3" />
                    <span>GOLDまで: 配信{Math.max(0, 30 - Number(credit.streamingHours))}h / 売上¥{Math.max(0, 1000000 - Number(credit.monthlySales)).toLocaleString()}</span>
                  </div>
                </div>
              )}
              {credit.rank === "gold" && (
                <div className="mt-3 bg-gray-800/50 rounded p-2 text-xs text-gray-400">
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingUp className="h-3 w-3" />
                    <span>BLACKまで: 配信{Math.max(0, 60 - Number(credit.streamingHours))}h / 売上¥{Math.max(0, 3000000 - Number(credit.monthlySales)).toLocaleString()}</span>
                  </div>
                </div>
              )}

              {credit.isFirstMonth && (
                <div className="mt-3 bg-purple-900/30 border border-purple-700/50 rounded p-2 text-xs text-purple-300 flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  初月特典：定価合計10万円以内のサンプルを請求できます
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ============ CREDIT USAGE MENU ============ */}
        {credit && activeView === "list" && (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-3">
              <div className="text-xs text-gray-500 mb-2 font-semibold">クレジットの使い道</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-purple-400" />
                    <span className="text-sm text-white">サンプル請求</span>
                  </div>
                  <Badge className="bg-green-600 text-white text-xs">利用可能</Badge>
                </div>
                <div className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3 opacity-60">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm text-gray-300">特別報酬</span>
                  </div>
                  <Badge className="bg-gray-700 text-gray-400 text-xs">Coming Soon</Badge>
                </div>
                <div className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3 opacity-60">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-pink-400" />
                    <span className="text-sm text-gray-300">限定ガチャ</span>
                  </div>
                  <Badge className="bg-gray-700 text-gray-400 text-xs">Coming Soon</Badge>
                </div>
                <div className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3 opacity-60">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-gray-300">BWポイント交換</span>
                  </div>
                  <Badge className="bg-gray-700 text-gray-400 text-xs">Coming Soon</Badge>
                </div>
              </div>
              <div className="text-xs text-gray-600 mt-2 text-center">新機能は順次追加予定です</div>
            </CardContent>
          </Card>
        )}

        {/* ============ LIST VIEW ============ */}
        {activeView === "list" && (
          <>
            <Button
              onClick={startCreate}
              className="w-full bg-purple-600 hover:bg-purple-700 h-12 text-base"
            >
              <Plus className="h-5 w-5 mr-2" />
              新しいサンプル請求
            </Button>

            {/* Request History */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                請求履歴
              </h2>

              {requests.length === 0 ? (
                <Card className="bg-gray-900 border-gray-800">
                  <CardContent className="p-6 text-center text-gray-500">
                    <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">まだサンプル請求がありません</p>
                  </CardContent>
                </Card>
              ) : (
                requests.map((req: any) => {
                  const sc = statusConfig[req.status] || statusConfig.pending;
                  const StatusIcon = sc.icon;
                  return (
                    <Card
                      key={req.id}
                      className="bg-gray-900 border-gray-800 cursor-pointer hover:border-gray-600 transition-colors"
                      onClick={() => { setSelectedRequest(req); setActiveView("detail"); }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={`${sc.color} text-white text-xs`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {sc.label}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(req.createdAt).toLocaleDateString("ja-JP")}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-sm text-white">
                              {(req.items || []).map((i: any) => i.productName).join(", ").slice(0, 40)}
                              {(req.items || []).map((i: any) => i.productName).join(", ").length > 40 ? "..." : ""}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {(req.items || []).length}商品 ・ 配信予定: {new Date(req.scheduledDate).toLocaleDateString("ja-JP")}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-white">¥{Number(req.totalAmount).toLocaleString()}</div>
                            {Number(req.creditUsed) > 0 && (
                              <div className="text-xs text-purple-400">クレジット: ¥{Number(req.creditUsed).toLocaleString()}</div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ============ CREATE VIEW ============ */}
        {activeView === "create" && (
          <div className="space-y-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">新しいサンプル請求</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setHowToOpen(true)}
                    className="text-purple-400 hover:text-purple-300 h-8 px-2"
                  >
                    <HelpCircle className="h-4 w-4 mr-1" />
                    <span className="text-xs">入力ガイド</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Scheduled Date */}
                <div>
                  <Label className="text-gray-400 text-sm">配信予定日時 *</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledDate}
                    onChange={e => setScheduledDate(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white mt-1"
                  />
                </div>

                {/* Shipping Address */}
                <div className="space-y-3">
                  <Label className="text-gray-400 text-sm">配送先住所 *</Label>
                  <div className="flex gap-2">
                    <div className="w-1/3">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={postalCode}
                        onChange={e => setPostalCode(e.target.value.replace(/[^0-9-]/g, ""))}
                        placeholder="〒 000-0000"
                        className="bg-gray-800 border-gray-700 text-white text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="電話番号"
                        className="bg-gray-800 border-gray-700 text-white text-sm"
                      />
                    </div>
                  </div>
                  <Input
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="都道府県市区町村 番地 建物名・部屋番号"
                    className="bg-gray-800 border-gray-700 text-white text-sm"
                  />
                </div>

                {/* Products */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-gray-400 text-sm">商品一覧 *</Label>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSearchOpen(true)}
                        className="h-7 text-xs border-purple-600 text-purple-400 hover:bg-purple-900/30">
                        <Search className="h-3 w-3 mr-1" />
                        商品検索
                      </Button>
                      <Button size="sm" variant="outline" onClick={addCustomItem}
                        className="h-7 text-xs border-gray-600 text-gray-400 hover:bg-gray-800">
                        <Plus className="h-3 w-3 mr-1" />
                        手動追加
                      </Button>
                    </div>
                  </div>

                  {items.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center text-gray-500 text-sm">
                      「商品検索」で商品マスタから選択、または「手動追加」
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {items.map((item, idx) => (
                        <div key={idx} className="bg-gray-800 rounded-lg p-3 relative">
                          <div className="flex items-center justify-between mb-2">
                            <Input
                              value={item.productName}
                              onChange={e => updateItem(idx, "productName", e.target.value)}
                              placeholder="商品名"
                              className="bg-gray-700 border-gray-600 text-white text-sm flex-1 mr-2"
                              readOnly={!!item.mallProductId}
                            />
                            <Button size="icon" variant="ghost" onClick={() => removeItem(idx)}
                              className="h-8 w-8 text-red-400 hover:text-red-300">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex gap-2 items-center">
                            <div className="flex-1">
                              <Label className="text-gray-500 text-xs">単価</Label>
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={item.price === 0 ? "" : String(item.price)}
                                onChange={e => {
                                  const v = e.target.value.replace(/[^0-9]/g, "");
                                  updateItem(idx, "price", v === "" ? 0 : parseInt(v, 10));
                                }}
                                placeholder="0"
                                className="bg-gray-700 border-gray-600 text-white text-sm"
                                readOnly={!!item.mallProductId}
                              />
                            </div>
                            <div className="w-20">
                              <Label className="text-gray-500 text-xs">数量</Label>
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={item.quantity === 0 ? "" : String(item.quantity)}
                                onChange={e => {
                                  const v = e.target.value.replace(/[^0-9]/g, "");
                                  const qty = v === "" ? 0 : Math.min(parseInt(v, 10), 2);
                                  updateItem(idx, "quantity", qty);
                                }}
                                placeholder="1"
                                className="bg-gray-700 border-gray-600 text-white text-sm"
                              />
                            </div>
                            <div className="text-right min-w-[60px] pt-4">
                              <span className="text-sm text-white">¥{(item.price * item.quantity).toLocaleString()}</span>
                            </div>
                          </div>
                          {item.quantity >= 2 && (
                            <div className="text-xs text-yellow-500 mt-1">※ 同一商品は月2個まで</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Price Summary */}
                {items.length > 0 && (
                  <Card className="bg-gray-800/50 border-gray-700">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">定価合計</span>
                        <span className="text-white font-semibold">¥{totalAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-purple-400">クレジット使用</span>
                        <span className="text-purple-400">-¥{creditUsed.toLocaleString()}</span>
                      </div>
                      {outOfPocket > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-orange-400">実費（60%OFF）</span>
                          <span className="text-orange-400">¥{outOfPocket.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="border-t border-gray-700 pt-2 flex justify-between text-sm">
                        <span className="text-gray-400">クレジット残高（請求後）</span>
                        <span className="text-green-400 font-semibold">
                          ¥{Math.max(0, Number(credit?.remainingCredit || 0) - creditUsed).toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Memo */}
                <div>
                  <Label className="text-gray-400 text-sm">メモ（任意）</Label>
                  <Textarea
                    value={memo}
                    onChange={e => setMemo(e.target.value)}
                    placeholder="特別な要望やメモがあれば記入してください"
                    className="bg-gray-800 border-gray-700 text-white mt-1"
                    rows={3}
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="bg-red-900/50 border border-red-700 rounded p-2 text-red-300 text-sm">
                    {error}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 border-gray-600" onClick={() => setActiveView("list")}>
                    キャンセル
                  </Button>
                  <Button
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                    onClick={handleSubmit}
                    disabled={createMutation.isPending}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {createMutation.isPending ? "送信中..." : "請求する"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ============ DETAIL VIEW ============ */}
        {activeView === "detail" && selectedRequest && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">請求詳細 #{selectedRequest.id}</CardTitle>
                <Badge className={`${statusConfig[selectedRequest.status]?.color} text-white text-xs`}>
                  {statusConfig[selectedRequest.status]?.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">配信予定日</span>
                  <div className="text-white">{new Date(selectedRequest.scheduledDate).toLocaleDateString("ja-JP")}</div>
                </div>
                <div>
                  <span className="text-gray-500">申請日</span>
                  <div className="text-white">{new Date(selectedRequest.createdAt).toLocaleDateString("ja-JP")}</div>
                </div>
              </div>

              {/* Shipping Address */}
              {selectedRequest.address && (
                <div>
                  <span className="text-gray-500 text-sm">配送先</span>
                  <div className="text-white text-sm mt-1 bg-gray-800 rounded p-2">
                    {selectedRequest.postalCode && <span>〒{selectedRequest.postalCode} </span>}
                    {selectedRequest.address}
                    {selectedRequest.phone && <div className="text-gray-400 text-xs mt-1">TEL: {selectedRequest.phone}</div>}
                  </div>
                </div>
              )}

              {/* Items */}
              <div>
                <span className="text-gray-500 text-sm">商品一覧</span>
                <div className="mt-1 space-y-1">
                  {(selectedRequest.items || []).map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between bg-gray-800 rounded p-2 text-sm">
                      <span className="text-white">{item.productName} × {item.quantity}</span>
                      <span className="text-gray-400">¥{(Number(item.price) * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Summary */}
              <div className="bg-gray-800/50 rounded p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">定価合計</span>
                  <span className="text-white">¥{Number(selectedRequest.totalAmount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-400">クレジット使用</span>
                  <span className="text-purple-400">-¥{Number(selectedRequest.creditUsed).toLocaleString()}</span>
                </div>
                {Number(selectedRequest.outOfPocketAmount) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-orange-400">実費（60%OFF）</span>
                    <span className="text-orange-400">¥{Number(selectedRequest.outOfPocketAmount).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Memo */}
              {selectedRequest.memo && (
                <div>
                  <span className="text-gray-500 text-sm">メモ</span>
                  <div className="text-white text-sm mt-1 bg-gray-800 rounded p-2">{selectedRequest.memo}</div>
                </div>
              )}

              {/* Admin Comment */}
              {selectedRequest.adminComment && (
                <div>
                  <span className="text-gray-500 text-sm">運営コメント</span>
                  <div className="text-yellow-300 text-sm mt-1 bg-gray-800 rounded p-2">{selectedRequest.adminComment}</div>
                </div>
              )}

              {selectedRequest.status === "shipped" && selectedRequest.shippedAt && (
                <div className="bg-blue-900/30 border border-blue-700/50 rounded p-2 text-blue-300 text-sm flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  発送済み: {new Date(selectedRequest.shippedAt).toLocaleDateString("ja-JP")}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ============ SEARCH DIALOG ============ */}
        <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
          <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle>商品を検索</DialogTitle>
            </DialogHeader>
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="商品名・ブランド名で検索"
              className="bg-gray-800 border-gray-700 text-white"
              autoFocus
            />
            <div className="max-h-60 overflow-y-auto space-y-1">
              {searchProductsQuery.data?.map((product: any) => (
                <div
                  key={product.id}
                  className="flex justify-between items-center p-2 rounded hover:bg-gray-800 cursor-pointer"
                  onClick={() => addProduct(product)}
                >
                  <div>
                    <div className="text-sm text-white">{product.name}</div>
                    {product.brand && <div className="text-xs text-gray-500">{product.brand}</div>}
                  </div>
                  <span className="text-sm text-purple-400">¥{product.regularPrice.toLocaleString()}</span>
                </div>
              ))}
              {searchQuery.length >= 1 && searchProductsQuery.data?.length === 0 && (
                <div className="text-center text-gray-500 text-sm py-4">該当する商品がありません</div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* ============ HOW TO DIALOG ============ */}
        <Dialog open={howToOpen} onOpenChange={setHowToOpen}>
          <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-purple-400" />
                サンプル請求の手順
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <div className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                <div>
                  <div className="font-semibold text-white">配信予定日を入力</div>
                  <div className="text-gray-400">サンプルを使用する配信の予定日時を入力してください</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                <div>
                  <div className="font-semibold text-white">商品を追加</div>
                  <div className="text-gray-400">「商品検索」から商品マスタの商品を選択。見つからない場合は「手動追加」</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                <div>
                  <div className="font-semibold text-white">数量を確認</div>
                  <div className="text-gray-400">同一商品は月2個まで。クレジット残高を超える分は60%OFFの実費になります</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">4</div>
                <div>
                  <div className="font-semibold text-white">請求を送信</div>
                  <div className="text-gray-400">運営が確認・承認後、サンプルが発送されます</div>
                </div>
              </div>

              <div className="bg-gray-800 rounded p-3 mt-2">
                <div className="text-xs text-gray-400 space-y-1">
                  <p>※ 未使用クレジットは翌月に繰り越されます</p>
                  <p>※ 当月配信予定のある方のみクレジット使用可能</p>
                  <p>※ 配信に使用する商品のみクレジット使用可能</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setHowToOpen(false)} className="w-full bg-purple-600 hover:bg-purple-700">
                OK
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* ============ RANK DETAIL DIALOG ============ */}
        <Dialog open={rankDetailOpen} onOpenChange={setRankDetailOpen}>
          <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-yellow-400" />
                ライバーランク制度
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* SILVER */}
              <div className={`rounded-lg border p-3 ${credit?.rank === "silver" ? "border-gray-400 bg-gray-800" : "border-gray-700 bg-gray-800/50"}`}>
                <div className="flex items-center justify-between mb-2">
                  <Badge className="bg-gradient-to-r from-gray-300 to-gray-400 text-gray-900 text-xs px-3">
                    🥈 SILVER
                  </Badge>
                  {credit?.rank === "silver" && <Badge className="bg-green-600 text-white text-xs">現在</Badge>}
                </div>
                <div className="text-xs space-y-1 text-gray-300">
                  <div className="font-semibold text-gray-200 mb-1">達成条件</div>
                  <p>・月間配信 10時間以上</p>
                  <p>・月間売上 50万円以上</p>
                  <div className="font-semibold text-gray-200 mt-2 mb-1">特典</div>
                  <p>・翌月クレジット: +5,000円ボーナス</p>
                  <p>・ SILVER専用セットの作成が可能</p>
                  <p>・新作サンプル請求の優先対応</p>
                  <p>・グループLINE「SILVERバッジ」付与</p>
                </div>
              </div>

              {/* GOLD */}
              <div className={`rounded-lg border p-3 ${credit?.rank === "gold" ? "border-yellow-500 bg-yellow-900/20" : "border-gray-700 bg-gray-800/50"}`}>
                <div className="flex items-center justify-between mb-2">
                  <Badge className="bg-gradient-to-r from-yellow-500 to-amber-400 text-gray-900 text-xs px-3">
                    🥇 GOLD
                  </Badge>
                  {credit?.rank === "gold" && <Badge className="bg-green-600 text-white text-xs">現在</Badge>}
                </div>
                <div className="text-xs space-y-1 text-gray-300">
                  <div className="font-semibold text-gray-200 mb-1">達成条件</div>
                  <p>・月間配信 30時間以上</p>
                  <p>・月間売上 100万円以上</p>
                  <div className="font-semibold text-gray-200 mt-2 mb-1">特典</div>
                  <p>・翌月クレジット: +15,000円ボーナス</p>
                  <p>・マジック（30%割引）: 1時間に1アイテム</p>
                  <p>・新商品を毎月2点無料提供</p>
                  <p>・ブランドコラボ企画への優先参加</p>
                </div>
              </div>

              {/* BLACK */}
              <div className={`rounded-lg border p-3 ${credit?.rank === "black" ? "border-purple-500 bg-purple-900/20" : "border-gray-700 bg-gray-800/50"}`}>
                <div className="flex items-center justify-between mb-2">
                  <Badge className="bg-gradient-to-r from-gray-900 to-black border border-purple-500 text-purple-300 text-xs px-3">
                    🖤 BLACK
                  </Badge>
                  {credit?.rank === "black" && <Badge className="bg-green-600 text-white text-xs">現在</Badge>}
                </div>
                <div className="text-xs space-y-1 text-gray-300">
                  <div className="font-semibold text-gray-200 mb-1">達成条件</div>
                  <p>・月間配信 60時間以上</p>
                  <p>・月間売上 300万円以上</p>
                  <div className="font-semibold text-gray-200 mt-2 mb-1">特典</div>
                  <p>・翌月クレジット: +50,000円ボーナス</p>
                  <p>・マジック（30%割引）: 制限なし</p>
                  <p>・新商品を毎月5点無料提供</p>
                  <p>・専属マネージャーがサポート</p>
                  <p>・ブランドアンバサダー契約の優先交渉</p>
                  <p>・年間表彰イベントへの招待</p>
                </div>
              </div>

              {/* Credit Calculation */}
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-200 mb-2">クレジット計算方法</div>
                <div className="text-xs text-gray-400 space-y-1">
                  <p>・配信時間 × 500円</p>
                  <p>・月間売上 × 3%</p>
                  <p>・ランクボーナス（上記参照）</p>
                  <p className="text-purple-400 mt-1">※ 未使用クレジットは翌月に繰り越されます</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setRankDetailOpen(false)} className="w-full bg-purple-600 hover:bg-purple-700">
                閉じる
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
