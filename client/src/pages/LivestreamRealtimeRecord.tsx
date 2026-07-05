import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Clock, ShoppingCart, Package, TrendingUp, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";

// 30分刻みのタイムスロット生成
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    slots.push(`${h.toString().padStart(2, '0')}:30`);
  }
  return slots;
}

// 現在時刻に最も近いタイムスロットを返す
function getCurrentTimeSlot(): string {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const slot = m < 30 ? `${h.toString().padStart(2, '0')}:00` : `${h.toString().padStart(2, '0')}:30`;
  return slot;
}

export default function LivestreamRealtimeRecord() {
  const params = useParams<{ id: string }>();
  const livestreamId = parseInt(params.id || "0", 10);

  // 配信情報取得
  const { data: livestream } = trpc.brandLivestream.getLivestreamDetail.useQuery(
    { id: livestreamId },
    { enabled: livestreamId > 0 }
  );

  // リアルタイム記録取得
  const { data: records, refetch } = trpc.realtimeRecord.getByLivestream.useQuery(
    { livestreamId },
    { enabled: livestreamId > 0, refetchInterval: 10000 } // 10秒ごとに自動更新
  );

  // 入力状態
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [quantitySold, setQuantitySold] = useState("0");
  const [cartAddCount, setCartAddCount] = useState("0");
  const [timeSlot, setTimeSlot] = useState(getCurrentTimeSlot());
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQuantity, setEditQuantity] = useState("");

  // 商品候補（過去の記録から）
  const productSuggestions = useMemo(() => {
    if (!records) return [];
    const names = new Set(records.map(r => r.productName));
    return Array.from(names);
  }, [records]);

  // Mutation
  const addMutation = trpc.realtimeRecord.add.useMutation({
    onSuccess: () => {
      toast.success("記録しました！");
      setProductName("");
      setProductPrice("");
      setQuantitySold("0");
      setCartAddCount("0");
      setNotes("");
      refetch();
    },
    onError: (err) => toast.error(`エラー: ${err.message}`),
  });

  const updateMutation = trpc.realtimeRecord.update.useMutation({
    onSuccess: () => {
      toast.success("更新しました");
      setEditingId(null);
      refetch();
    },
    onError: (err) => toast.error(`エラー: ${err.message}`),
  });

  const deleteMutation = trpc.realtimeRecord.delete.useMutation({
    onSuccess: () => {
      toast.success("削除しました");
      refetch();
    },
    onError: (err) => toast.error(`エラー: ${err.message}`),
  });

  // 記録追加
  const handleAdd = () => {
    if (!productName.trim()) {
      toast.error("商品名を入力してください");
      return;
    }
    addMutation.mutate({
      livestreamId,
      liverId: livestream?.liverId || undefined,
      productName: productName.trim(),
      productPrice: productPrice ? parseInt(productPrice) : undefined,
      quantitySold: parseInt(quantitySold) || 0,
      cartAddCount: parseInt(cartAddCount) || 0,
      timeSlot,
      notes: notes || undefined,
    });
  };

  // 時間帯別集計
  const timeSlotSummary = useMemo(() => {
    if (!records || records.length === 0) return [];
    const map = new Map<string, { quantity: number; revenue: number; cartAdds: number; products: string[] }>();
    for (const r of records) {
      const existing = map.get(r.timeSlot) || { quantity: 0, revenue: 0, cartAdds: 0, products: [] };
      existing.quantity += r.quantitySold;
      existing.revenue += (Number(r.productPrice) || 0) * r.quantitySold;
      existing.cartAdds += r.cartAddCount || 0;
      if (!existing.products.includes(r.productName)) existing.products.push(r.productName);
      map.set(r.timeSlot, existing);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([slot, data]) => ({ timeSlot: slot, ...data }));
  }, [records]);

  // 合計
  const totals = useMemo(() => {
    if (!records || records.length === 0) return { quantity: 0, revenue: 0, cartAdds: 0 };
    return records.reduce((acc, r) => ({
      quantity: acc.quantity + r.quantitySold,
      revenue: acc.revenue + (Number(r.productPrice) || 0) * r.quantitySold,
      cartAdds: acc.cartAdds + (r.cartAddCount || 0),
    }), { quantity: 0, revenue: 0, cartAdds: 0 });
  }, [records]);

  const timeSlots = generateTimeSlots();

  if (!livestreamId) {
    return <div className="p-4 text-center text-gray-400">配信IDが無効です</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-32">
      {/* ヘッダー */}
      <div className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href={`/master/livestreams/${livestreamId}`}>
            <ArrowLeft className="h-5 w-5 text-gray-400" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold truncate">🔴 リアルタイム記録</h1>
            <p className="text-[10px] text-gray-400 truncate">
              {livestream?.streamerName || "..."} • {livestream?.livestreamDate ? new Date(livestream.livestreamDate).toLocaleDateString('ja-JP') : ""}
            </p>
          </div>
          {/* リアルタイムサマリー */}
          <div className="text-right">
            <p className="text-xs text-green-400 font-bold">¥{totals.revenue.toLocaleString()}</p>
            <p className="text-[10px] text-gray-400">{totals.quantity}件出単</p>
          </div>
        </div>
      </div>

      {/* クイック入力フォーム */}
      <div className="p-4 space-y-3">
        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4 space-y-3">
            {/* 時間帯選択 */}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400 shrink-0" />
              <Select value={timeSlot} onValueChange={setTimeSlot}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 max-h-60">
                  {timeSlots.map(slot => (
                    <SelectItem key={slot} value={slot} className="text-white">{slot}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                className="text-xs border-blue-500 text-blue-400 shrink-0"
                onClick={() => setTimeSlot(getCurrentTimeSlot())}
              >
                今
              </Button>
            </div>

            {/* 商品名 */}
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-purple-400 shrink-0" />
              <Input
                placeholder="商品名"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white h-9"
                list="product-suggestions"
              />
              <datalist id="product-suggestions">
                {productSuggestions.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            {/* 単価・出単数・カート追加 */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-gray-400 mb-1 block">単価(¥)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 mb-1 block">出単数</label>
                <Input
                  type="number"
                  min="0"
                  value={quantitySold}
                  onChange={(e) => setQuantitySold(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 mb-1 block">カート追加</label>
                <Input
                  type="number"
                  min="0"
                  value={cartAddCount}
                  onChange={(e) => setCartAddCount(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white h-9 text-sm"
                />
              </div>
            </div>

            {/* メモ（任意） */}
            <Input
              placeholder="メモ（任意：話術、反応など）"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white h-9 text-sm"
            />

            {/* 記録ボタン */}
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12 text-base"
              onClick={handleAdd}
              disabled={addMutation.isPending}
            >
              <Plus className="h-5 w-5 mr-2" />
              {addMutation.isPending ? "記録中..." : "記録する"}
            </Button>
          </CardContent>
        </Card>

        {/* 時間帯別サマリー */}
        {timeSlotSummary.length > 0 && (
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="p-4">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-yellow-400" />
                時間帯別サマリー
              </h3>
              <div className="space-y-2">
                {timeSlotSummary.map(slot => (
                  <div key={slot.timeSlot} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-blue-300">{slot.timeSlot}</span>
                      <span className="text-[10px] text-gray-400">{slot.products.length}商品</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-green-400">¥{slot.revenue.toLocaleString()}</span>
                      <span className="text-white">{slot.quantity}件</span>
                      {slot.cartAdds > 0 && (
                        <span className="text-amber-400">🛒{slot.cartAdds}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {/* 合計 */}
              <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between">
                <span className="text-xs text-gray-400">合計</span>
                <div className="flex items-center gap-3 text-sm font-bold">
                  <span className="text-green-400">¥{totals.revenue.toLocaleString()}</span>
                  <span className="text-white">{totals.quantity}件</span>
                  {totals.cartAdds > 0 && (
                    <span className="text-amber-400">🛒{totals.cartAdds}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 記録一覧 */}
        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-green-400" />
              記録一覧 ({records?.length || 0}件)
            </h3>
            {(!records || records.length === 0) ? (
              <p className="text-xs text-gray-500 text-center py-4">まだ記録がありません。配信中に商品の出単を記録しましょう！</p>
            ) : (
              <div className="space-y-2">
                {records.map(record => (
                  <div key={record.id} className="bg-gray-800/50 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-[10px] font-mono text-blue-300 shrink-0">{record.timeSlot}</span>
                        <span className="text-xs text-white truncate">{record.productName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {editingId === record.id ? (
                          <>
                            <Input
                              type="number"
                              min="0"
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(e.target.value)}
                              className="w-16 h-7 bg-gray-700 border-gray-600 text-white text-xs"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-green-400"
                              onClick={() => {
                                updateMutation.mutate({ id: record.id, quantitySold: parseInt(editQuantity) || 0 });
                              }}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-gray-400"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            {record.productPrice && (
                              <span className="text-[10px] text-gray-400">¥{Number(record.productPrice).toLocaleString()}</span>
                            )}
                            <span className="text-xs font-bold text-yellow-400">{record.quantitySold}件</span>
                            {(record.cartAddCount || 0) > 0 && (
                              <span className="text-[10px] text-amber-400">🛒{record.cartAddCount}</span>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-gray-400 hover:text-blue-400"
                              onClick={() => { setEditingId(record.id); setEditQuantity(record.quantitySold.toString()); }}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-gray-400 hover:text-red-400"
                              onClick={() => {
                                if (confirm("この記録を削除しますか？")) {
                                  deleteMutation.mutate({ id: record.id });
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {record.notes && (
                      <p className="text-[10px] text-gray-400 mt-1 pl-12">💬 {record.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
