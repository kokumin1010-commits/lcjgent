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
  DollarSign,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Edit,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// Types
interface SetItem {
  productMasterId?: number;
  productName: string;
  originalPrice: number;
  quantity: number;
}

interface ApplicationData {
  id: number;
  setName: string;
  setPrice: number;
  totalOriginalPrice: number;
  discountRate: number;
  scheduledDate: string | null;
  status: string;
  adminComment: string | null;
  memo: string | null;
  createdAt: string;
  items: Array<{
    id: number;
    productName: string;
    originalPrice: number;
    quantity: number;
    productMasterId: number | null;
  }>;
}

const STATUS_CONFIG: Record<string, { label: string; labelZh: string; color: string; icon: any }> = {
  pending: { label: "審査中", labelZh: "审核中", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
  approved: { label: "承認済み", labelZh: "已批准", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle },
  rejected: { label: "却下", labelZh: "已拒绝", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
  revision_requested: { label: "修正依頼", labelZh: "需修改", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: AlertTriangle },
};

export default function LiverSetApplication() {
  const [, navigate] = useLocation();
  const token = getLiverToken();

  // State
  const [activeView, setActiveView] = useState<"list" | "create" | "edit">("list");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Form state
  const [setName, setSetName] = useState("");
  const [setPrice, setSetPrice] = useState<number>(0);
  const [scheduledDate, setScheduledDate] = useState("");
  const [memo, setMemo] = useState("");
  const [items, setItems] = useState<SetItem[]>([]);

  // Product search
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [productKeyword, setProductKeyword] = useState("");

  // Filter
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // API calls
  const myListQuery = trpc.setApplication.myList.useQuery(
    { status: statusFilter as any },
    { enabled: !!token }
  );

  const productSearchQuery = trpc.setApplication.searchProducts.useQuery(
    { keyword: productKeyword, limit: 30 },
    { enabled: productSearchOpen && productKeyword.length > 0 }
  );

  const createMutation = trpc.setApplication.create.useMutation({
    onSuccess: () => {
      resetForm();
      setActiveView("list");
      myListQuery.refetch();
    },
  });

  const updateMutation = trpc.setApplication.update.useMutation({
    onSuccess: () => {
      resetForm();
      setActiveView("list");
      myListQuery.refetch();
    },
  });

  const deleteMutation = trpc.setApplication.delete.useMutation({
    onSuccess: () => {
      myListQuery.refetch();
    },
  });

  // Computed
  const totalOriginalPrice = useMemo(
    () => items.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0),
    [items]
  );

  const discountRate = useMemo(
    () => totalOriginalPrice > 0 ? Math.round(((totalOriginalPrice - setPrice) / totalOriginalPrice) * 100) : 0,
    [totalOriginalPrice, setPrice]
  );

  // セット価格がまだ手動設定されていない場合、元値合計を自動セット
  const [priceManuallySet, setPriceManuallySet] = useState(false);
  useEffect(() => {
    if (!priceManuallySet && totalOriginalPrice > 0) {
      setSetPrice(totalOriginalPrice);
    }
  }, [totalOriginalPrice, priceManuallySet]);

  // Helpers
  function resetForm() {
    setSetName("");
    setSetPrice(0);
    setScheduledDate("");
    setMemo("");
    setItems([]);
    setEditingId(null);
    setPriceManuallySet(false);
  }

  function startCreate() {
    resetForm();
    setActiveView("create");
  }

  function startEdit(app: ApplicationData) {
    setSetName(app.setName);
    setSetPrice(app.setPrice);
    setPriceManuallySet(true); // 編集時は既存価格を維持
    setScheduledDate(app.scheduledDate ? new Date(app.scheduledDate).toISOString().slice(0, 16) : "");
    setMemo(app.memo || "");
    setItems(app.items.map(item => ({
      productMasterId: item.productMasterId || undefined,
      productName: item.productName,
      originalPrice: Number(item.originalPrice),
      quantity: item.quantity,
    })));
    setEditingId(app.id);
    setActiveView("edit");
  }

  function addProduct(product: { id: number; name: string; regularPrice: number | null }) {
    setItems(prev => [...prev, {
      productMasterId: product.id,
      productName: product.name,
      originalPrice: product.regularPrice || 0,
      quantity: 1,
    }]);
    setProductSearchOpen(false);
    setProductKeyword("");
  }

  function addCustomItem() {
    setItems(prev => [...prev, {
      productName: "",
      originalPrice: 0,
      quantity: 1,
    }]);
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof SetItem, value: any) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  function handleSubmit() {
    if (!setName.trim() || items.length === 0) return;
    
    const data = {
      setName: setName.trim(),
      setPrice,
      scheduledDate: scheduledDate || undefined,
      memo: memo.trim() || undefined,
      items: items.map(item => ({
        productMasterId: item.productMasterId,
        productName: item.productName,
        originalPrice: item.originalPrice,
        quantity: item.quantity,
      })),
    };

    if (editingId) {
      updateMutation.mutate({ applicationId: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  }

  // Auth check
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <Card className="bg-gray-900 border-gray-800 max-w-sm w-full">
          <CardContent className="p-6 text-center">
            <p className="text-white mb-4">ログインが必要です</p>
            <Button onClick={() => navigate("/liver/login")} className="bg-red-600 hover:bg-red-700">
              ログイン
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const applications = myListQuery.data || [];
  const pendingCount = applications.filter(a => a.status === "pending").length;
  const revisionCount = applications.filter(a => a.status === "revision_requested").length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (activeView !== "list") {
                setActiveView("list");
                resetForm();
              } else {
                navigate("/liver/mypage");
              }
            }}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">
              <Package className="inline h-5 w-5 mr-2 text-purple-400" />
              セット申請
            </h1>
            <p className="text-xs text-gray-400">ライブ前にセットを事前申請</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* ============ LIST VIEW ============ */}
        {activeView === "list" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: "all", label: "全部", count: applications.length, color: "text-white" },
                { key: "pending", label: "審査中", count: pendingCount, color: "text-yellow-400" },
                { key: "revision_requested", label: "修正", count: revisionCount, color: "text-orange-400" },
                { key: "approved", label: "承認", count: applications.filter(a => a.status === "approved").length, color: "text-green-400" },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => setStatusFilter(s.key)}
                  className={`p-2 rounded-lg text-center transition-all ${
                    statusFilter === s.key
                      ? "bg-gray-800 border border-gray-600"
                      : "bg-gray-900/50 border border-gray-800 hover:bg-gray-800/50"
                  }`}
                >
                  <div className={`text-lg font-bold ${s.color}`}>{s.count}</div>
                  <div className="text-xs text-gray-400">{s.label}</div>
                </button>
              ))}
            </div>

            {/* New Application Button */}
            <Button
              onClick={startCreate}
              className="w-full bg-purple-600 hover:bg-purple-700 h-12 text-base"
            >
              <Plus className="h-5 w-5 mr-2" />
              新しいセットを申請
            </Button>

            {/* Application List */}
            {applications.length === 0 ? (
              <Card className="bg-gray-900/50 border-gray-800 border-dashed">
                <CardContent className="p-8 text-center">
                  <Package className="h-10 w-10 mx-auto text-gray-600 mb-3" />
                  <p className="text-gray-400">まだ申請がありません</p>
                  <p className="text-gray-500 text-sm mt-1">「新しいセットを申請」ボタンから始めましょう</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {applications.map((app: any) => {
                  const config = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending;
                  const StatusIcon = config.icon;
                  const isExpanded = expandedId === app.id;
                  
                  return (
                    <Card key={app.id} className="bg-gray-900 border-gray-800 overflow-hidden">
                      <div
                        className="p-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : app.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={`${config.color} border text-xs`}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {config.label}
                              </Badge>
                              {app.scheduledDate && (
                                <span className="text-xs text-gray-500">
                                  <Calendar className="inline h-3 w-3 mr-1" />
                                  {new Date(app.scheduledDate).toLocaleDateString("ja-JP")}
                                </span>
                              )}
                            </div>
                            <h3 className="font-semibold text-white truncate">{app.setName}</h3>
                            <div className="flex items-center gap-3 mt-1 text-sm">
                              <span className="text-purple-400 font-medium">
                                ¥{Number(app.setPrice).toLocaleString()}
                              </span>
                              <span className="text-gray-500">
                                ({app.items?.length || 0}商品)
                              </span>
                              {Number(app.discountRate) > 0 && (
                                <span className="text-green-400 text-xs">
                                  {app.discountRate}%OFF
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            {(app.status === "pending" || app.status === "revision_requested") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); startEdit(app); }}
                                className="text-gray-400 hover:text-white h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-gray-500" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-500" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t border-gray-800 p-4 space-y-3 bg-gray-900/50">
                          {/* Admin Comment */}
                          {app.adminComment && (
                            <div className={`p-3 rounded-lg ${
                              app.status === "rejected" ? "bg-red-500/10 border border-red-500/20" :
                              app.status === "revision_requested" ? "bg-orange-500/10 border border-orange-500/20" :
                              "bg-green-500/10 border border-green-500/20"
                            }`}>
                              <p className="text-xs text-gray-400 mb-1">運営コメント:</p>
                              <p className="text-sm text-white">{app.adminComment}</p>
                            </div>
                          )}

                          {/* Items */}
                          <div>
                            <p className="text-xs text-gray-400 mb-2">商品一覧:</p>
                            <div className="space-y-1">
                              {(app.items || []).map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-sm py-1 px-2 bg-gray-800/50 rounded">
                                  <span className="text-gray-300 truncate flex-1">{item.productName}</span>
                                  <span className="text-gray-400 ml-2 whitespace-nowrap">
                                    ¥{Number(item.originalPrice).toLocaleString()} x{item.quantity}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-700 text-sm">
                              <span className="text-gray-400">元値合計</span>
                              <span className="text-white">¥{Number(app.totalOriginalPrice).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-400">セット価格</span>
                              <span className="text-purple-400 font-bold">¥{Number(app.setPrice).toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Memo */}
                          {app.memo && (
                            <div className="text-sm">
                              <p className="text-xs text-gray-400 mb-1">メモ:</p>
                              <p className="text-gray-300">{app.memo}</p>
                            </div>
                          )}

                          {/* Actions */}
                          {(app.status === "pending" || app.status === "revision_requested") && (
                            <div className="flex gap-2 pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEdit(app)}
                                className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                編集
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (confirm("この申請を削除しますか？")) {
                                    deleteMutation.mutate({ applicationId: app.id });
                                  }
                                }}
                                className="border-red-800 text-red-400 hover:bg-red-900/30"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}

                          <div className="text-xs text-gray-600 text-right">
                            申請日: {new Date(app.createdAt).toLocaleString("ja-JP")}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ============ CREATE / EDIT VIEW ============ */}
        {(activeView === "create" || activeView === "edit") && (
          <div className="space-y-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {activeView === "edit" ? "セット申請を編集" : "新しいセット申請"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Set Name */}
                <div>
                  <Label className="text-gray-400 text-sm">セット名 *</Label>
                  <Input
                    value={setName}
                    onChange={e => setSetName(e.target.value)}
                    placeholder="例: KYOGOKUヘアケアセット"
                    className="bg-gray-800 border-gray-700 text-white mt-1"
                  />
                </div>

                {/* Scheduled Date */}
                <div>
                  <Label className="text-gray-400 text-sm">配信予定日時</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledDate}
                    onChange={e => setScheduledDate(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white mt-1"
                  />
                </div>

                {/* Products */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-gray-400 text-sm">商品一覧 *</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setProductSearchOpen(true)}
                        className="border-purple-700 text-purple-400 hover:bg-purple-900/30 h-7 text-xs"
                      >
                        <Search className="h-3 w-3 mr-1" />
                        商品検索
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addCustomItem}
                        className="border-gray-700 text-gray-400 hover:bg-gray-800 h-7 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        手動追加
                      </Button>
                    </div>
                  </div>

                  {items.length === 0 ? (
                    <div className="border border-dashed border-gray-700 rounded-lg p-6 text-center">
                      <Package className="h-8 w-8 mx-auto text-gray-600 mb-2" />
                      <p className="text-gray-500 text-sm">商品を追加してください</p>
                      <p className="text-gray-600 text-xs mt-1">「商品検索」で商品マスタから選択、または「手動追加」</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {items.map((item, index) => (
                        <div key={index} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 space-y-2">
                              <Input
                                value={item.productName}
                                onChange={e => updateItem(index, "productName", e.target.value)}
                                placeholder="商品名"
                                className="bg-gray-800 border-gray-700 text-white text-sm h-8"
                              />
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <Label className="text-gray-500 text-xs">単価</Label>
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={item.originalPrice || ""}
                                    onChange={e => updateItem(index, "originalPrice", parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                                    placeholder="0"
                                    className="bg-gray-800 border-gray-700 text-white text-sm h-8"
                                  />
                                </div>
                                <div className="w-20">
                                  <Label className="text-gray-500 text-xs">数量</Label>
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={item.quantity || ""}
                                    onChange={e => updateItem(index, "quantity", Math.max(1, parseInt(e.target.value.replace(/[^0-9]/g, "")) || 1))}
                                    placeholder="1"
                                    className="bg-gray-800 border-gray-700 text-white text-sm h-8"
                                  />
                                </div>
                                <div className="w-24 text-right pt-4">
                                  <span className="text-gray-400 text-sm">
                                    ¥{(item.originalPrice * item.quantity).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(index)}
                              className="text-red-400 hover:text-red-300 h-8 w-8 p-0 mt-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Price Summary */}
                {items.length > 0 && (
                  <Card className="bg-gray-800/30 border-gray-700">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">元値合計</span>
                        <span className="text-white">¥{totalOriginalPrice.toLocaleString()}</span>
                      </div>
                      <div>
                        <Label className="text-gray-400 text-sm">セット価格 *</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={setPrice || ""}
                          onChange={e => { setSetPrice(parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0); setPriceManuallySet(true); }}
                          className="bg-gray-800 border-gray-700 text-white mt-1"
                          placeholder="希望販売価格"
                        />
                      </div>
                      <div className="flex justify-between text-sm pt-1 border-t border-gray-700">
                        <span className="text-gray-400">割引率</span>
                        <span className={`font-bold ${discountRate > 0 ? "text-green-400" : discountRate < 0 ? "text-red-400" : "text-gray-400"}`}>
                          {discountRate > 0 ? `${discountRate}%OFF` : discountRate < 0 ? `${Math.abs(discountRate)}%UP` : "0%"}
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
                    className="bg-gray-800 border-gray-700 text-white mt-1 min-h-[80px]"
                  />
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => { setActiveView("list"); resetForm(); }}
                    className="flex-1 border-gray-700 text-gray-400"
                  >
                    キャンセル
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!setName.trim() || items.length === 0 || createMutation.isPending || updateMutation.isPending}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {createMutation.isPending || updateMutation.isPending
                      ? "送信中..."
                      : editingId ? "更新する" : "申請する"
                    }
                  </Button>
                </div>

                {(createMutation.isError || updateMutation.isError) && (
                  <p className="text-red-400 text-sm text-center">
                    エラーが発生しました: {(createMutation.error || updateMutation.error)?.message}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Product Search Dialog */}
      <Dialog open={productSearchOpen} onOpenChange={setProductSearchOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>商品を検索</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={productKeyword}
              onChange={e => setProductKeyword(e.target.value)}
              placeholder="商品名で検索..."
              className="bg-gray-800 border-gray-700 text-white"
              autoFocus
            />
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {productSearchQuery.isLoading && (
                <p className="text-gray-500 text-sm text-center py-4">検索中...</p>
              )}
              {productSearchQuery.data?.length === 0 && productKeyword && (
                <p className="text-gray-500 text-sm text-center py-4">商品が見つかりません</p>
              )}
              {productSearchQuery.data?.map((product: any) => (
                <button
                  key={product.id}
                  onClick={() => addProduct(product)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
                >
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt="" className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center">
                      <Package className="h-5 w-5 text-gray-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{product.name}</p>
                    <p className="text-xs text-gray-400">
                      {product.regularPrice ? `¥${product.regularPrice.toLocaleString()}` : "価格未設定"}
                    </p>
                  </div>
                  <Plus className="h-4 w-4 text-purple-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
