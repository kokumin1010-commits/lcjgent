import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Clock, ShoppingCart, Package, TrendingUp, Edit2, Check, X, Camera, Loader2, ImageIcon, Gift, Upload } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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
  const [editProductName, setEditProductName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editCartAdd, setEditCartAdd] = useState("");
  const [editNotes, setEditNotes] = useState("");

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

  // ===== スクショAI解析 =====
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [snapshotTab, setSnapshotTab] = useState<'upload' | 'trend'>('upload');

  // スクショ一覧取得
  const { data: snapshots, refetch: refetchSnapshots } = trpc.realtimeRecord.getSnapshots.useQuery(
    { livestreamId },
    { enabled: livestreamId > 0 }
  );

  // スクショトレンド取得
  const { data: snapshotTrend } = trpc.realtimeRecord.getSnapshotTrend.useQuery(
    { livestreamId },
    { enabled: livestreamId > 0 }
  );

  const addSnapshotMutation = trpc.realtimeRecord.addSnapshot.useMutation({
    onSuccess: (data) => {
      const productCount = data.snapshot.products?.length || 0;
      const importedCount = (data as any).importedCount || 0;
      toast.success(`AI解析完了！GPM: ¥${data.snapshot.gpm?.toLocaleString() || '---'}${importedCount > 0 ? ` / ${importedCount}件の商品を記録に追加` : ''}`);
      refetchSnapshots();
      refetch(); // 記録一覧も更新
      setIsAnalyzing(false);
    },
    onError: (err) => {
      toast.error(`解析エラー: ${err.message}`);
      setIsAnalyzing(false);
    },
  });

  // AI商品一括インポート
  const bulkAddMutation = trpc.realtimeRecord.bulkAddFromSnapshot.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count}件の商品を記録に追加しました！`);
      refetch(); // 記録一覧を更新
    },
    onError: (err) => toast.error(`インポートエラー: ${err.message}`),
  });

  // スクショアップロードハンドラー
  const handleSnapshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    const isImage = file.type.startsWith('image/') || allowedTypes.some(t => file.name.toLowerCase().endsWith(t.split('/')[1]));
    if (!isImage) {
      toast.error('画像ファイルを選択してください（PNG, JPG, WebP, HEIC対応）');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('ファイルサイズは10MB以下にしてください');
      return;
    }
    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        const mimeType = file.type || 'image/png';
        addSnapshotMutation.mutate({
          livestreamId,
          liverId: livestream?.liverId || undefined,
          imageBase64: base64,
          mimeType,
          timeSlot,
          notes: notes || undefined,
        });
      };
      reader.onerror = () => {
        toast.error('ファイル読み込みエラー');
        setIsAnalyzing(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error('ファイル読み込みエラー');
      setIsAnalyzing(false);
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // GPMトレンドチャートデータ
  const trendChartData = useMemo(() => {
    if (!snapshotTrend || snapshotTrend.length === 0) return [];
    return snapshotTrend.map(s => ({
      timeSlot: s.timeSlot,
      gpm: s.gpm || 0,
      impressions: s.impressions ? Math.round(s.impressions / 1000) : 0, // K表示
      viewers: s.viewerCount ? Math.round(s.viewerCount / 1000) : 0, // K表示
    }));
  }, [snapshotTrend]);

  // リアルタイムアラートチェック
  const { data: alertData } = trpc.realtimeRecord.checkAlerts.useQuery(
    { livestreamId, gpmThreshold: 3000, noOrderMinutes: 30 },
    { enabled: livestreamId > 0, refetchInterval: 60000 } // 1分ごとにチェック
  );

  // AI商品輪番推薦
  const [showRecommendation, setShowRecommendation] = useState(false);
  const { data: carouselData, isLoading: isLoadingCarousel } = trpc.realtimeRecord.getCarouselRecommendation.useQuery(
    { liverId: livestream?.liverId || undefined, currentHour: new Date().getHours() },
    { enabled: showRecommendation && livestreamId > 0 }
  );

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

      {/* アラートバナー */}
      {alertData && alertData.alerts.length > 0 && (
        <div className="px-4 pt-3 space-y-2">
          {alertData.alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-2 ${
                alert.severity === 'critical'
                  ? 'bg-red-900/80 border border-red-600 text-red-200'
                  : 'bg-yellow-900/80 border border-yellow-600 text-yellow-200'
              }`}
            >
              <span className="text-base">{alert.severity === 'critical' ? '🚨' : '⚠️'}</span>
              <span className="flex-1">{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* AI商品輪番推薦ボタン */}
      <div className="px-4 pt-3">
        <Button
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold h-10 text-sm"
          onClick={() => setShowRecommendation(!showRecommendation)}
        >
          🤖 AI商品輪番戦略を生成
        </Button>
      </div>

      {/* AI推薦結果 */}
      {showRecommendation && (
        <div className="px-4 pt-3">
          <Card className="bg-indigo-950/50 border-indigo-700/50">
            <CardContent className="p-4">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                🤖 AI推薦商品順序
              </h3>
              {isLoadingCarousel ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                  <span className="ml-2 text-xs text-gray-400">AIが過去データを分析中...</span>
                </div>
              ) : carouselData?.recommendation ? (
                <div className="space-y-3">
                  {/* 戦略概要 */}
                  <p className="text-xs text-indigo-300 bg-indigo-900/30 rounded px-2 py-1.5">
                    💡 {carouselData.recommendation.overallStrategy}
                  </p>
                  {/* 推薦順序 */}
                  <div className="space-y-1.5">
                    {carouselData.recommendation.recommendedOrder?.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-2">
                        <span className="text-lg font-bold text-indigo-400 w-6 text-center">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white font-medium truncate">{item.productName}</p>
                          <p className="text-[10px] text-gray-400">{item.suggestedTimeSlot} • {item.reason}</p>
                        </div>
                        <span className="text-[10px] text-green-400 font-bold shrink-0">{item.expectedConversionBoost}</span>
                      </div>
                    ))}
                  </div>
                  {/* インサイト */}
                  {carouselData.recommendation.keyInsights?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] text-gray-500 font-bold">🔑 インサイト:</p>
                      {carouselData.recommendation.keyInsights.map((insight: string, idx: number) => (
                        <p key={idx} className="text-[10px] text-gray-400 pl-3">• {insight}</p>
                      ))}
                    </div>
                  )}
                  <p className="text-[9px] text-gray-600 text-right">
                    分析データ: {carouselData.dataPoints}件 / {carouselData.productsAnalyzed}商品
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-500 text-center py-4">
                  {carouselData?.message || '過去の配信データが必要です。リアルタイム記録を蓄積してください。'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

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

            {/* 商品記録一覧（フォーム直下に表示・全フィールド編集可能） */}
            {records && records.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-700">
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-green-400" />
                  商品記録 ({records.length}件)
                </h4>
                <div className="space-y-2">
                  {records.map(record => (
                    <div key={record.id} className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                      {editingId === record.id ? (
                        /* 編集モード */
                        <div className="space-y-2">
                          <Input
                            value={editProductName}
                            onChange={(e) => setEditProductName(e.target.value)}
                            placeholder="商品名"
                            className="bg-gray-700 border-gray-600 text-white text-sm h-9"
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] text-gray-400">単価(¥)</label>
                              <Input
                                type="number"
                                min="0"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                className="bg-gray-700 border-gray-600 text-white text-sm h-8"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400">出単数</label>
                              <Input
                                type="number"
                                min="0"
                                value={editQuantity}
                                onChange={(e) => setEditQuantity(e.target.value)}
                                className="bg-gray-700 border-gray-600 text-white text-sm h-8"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400">カート追加</label>
                              <Input
                                type="number"
                                min="0"
                                value={editCartAdd}
                                onChange={(e) => setEditCartAdd(e.target.value)}
                                className="bg-gray-700 border-gray-600 text-white text-sm h-8"
                              />
                            </div>
                          </div>
                          <Input
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="メモ"
                            className="bg-gray-700 border-gray-600 text-white text-sm h-9"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                              onClick={() => {
                                updateMutation.mutate({
                                  id: record.id,
                                  productName: editProductName,
                                  productPrice: parseInt(editPrice) || 0,
                                  quantitySold: parseInt(editQuantity) || 0,
                                  cartAddCount: parseInt(editCartAdd) || 0,
                                  notes: editNotes || undefined,
                                });
                              }}
                            >
                              <Check className="h-3 w-3 mr-1" />保存
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs border-gray-600 text-gray-300"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="h-3 w-3 mr-1" />キャンセル
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* 表示モード */
                        <div>
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-mono text-blue-300 bg-blue-900/30 px-1.5 py-0.5 rounded">{record.timeSlot}</span>
                                <span className="text-sm font-bold text-white">{record.productName}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs">
                                {record.productPrice && (
                                  <span className="text-gray-300">単価: <span className="text-green-400 font-bold">¥{Number(record.productPrice).toLocaleString()}</span></span>
                                )}
                                <span className="text-gray-300">出単: <span className="text-yellow-400 font-bold">{record.quantitySold}件</span></span>
                                {(record.cartAddCount || 0) > 0 && (
                                  <span className="text-gray-300">カート: <span className="text-amber-400 font-bold">{record.cartAddCount}</span></span>
                                )}
                              </div>
                              {record.notes && (
                                <p className="text-sm text-gray-400 mt-1">💬 {record.notes}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-gray-400 hover:text-blue-400"
                                onClick={() => {
                                  setEditingId(record.id);
                                  setEditProductName(record.productName);
                                  setEditPrice(record.productPrice ? String(record.productPrice) : '0');
                                  setEditQuantity(String(record.quantitySold));
                                  setEditCartAdd(String(record.cartAddCount || 0));
                                  setEditNotes(record.notes || '');
                                }}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
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
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
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

        {/* 📸 スクショAI解析セクション */}
        <Card className="bg-gray-900 border-purple-700/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Camera className="h-4 w-4 text-purple-400" />
                📸 スクショAI解析
              </h3>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={snapshotTab === 'upload' ? 'default' : 'ghost'}
                  className={`text-xs h-7 ${snapshotTab === 'upload' ? 'bg-purple-600' : 'text-gray-400'}`}
                  onClick={() => setSnapshotTab('upload')}
                >
                  アップロード
                </Button>
                <Button
                  size="sm"
                  variant={snapshotTab === 'trend' ? 'default' : 'ghost'}
                  className={`text-xs h-7 ${snapshotTab === 'trend' ? 'bg-purple-600' : 'text-gray-400'}`}
                  onClick={() => setSnapshotTab('trend')}
                >
                  GPM推移
                </Button>
              </div>
            </div>

            {snapshotTab === 'upload' && (
              <div className="space-y-3">
                {/* アップロードボタン */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/heic,image/heif"
                  className="hidden"
                  onChange={handleSnapshotUpload}
                />
                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold h-12 text-base"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <><Loader2 className="h-5 w-5 mr-2 animate-spin" />AI解析中...</>
                  ) : (
                    <><Camera className="h-5 w-5 mr-2" />スクショをアップロード</>
                  )}
                </Button>
                <p className="text-[10px] text-gray-500 text-center">
                  TikTokダッシュボードのスクショをアップ→AIがGPM・インプレ・視聴者数等を自動抽出
                </p>

                {/* スクショ履歴 */}
                {snapshots && snapshots.length > 0 && (
                  <div className="space-y-2 mt-3">
                    <p className="text-xs text-gray-400 font-bold">解析履歴 ({snapshots.length}件)</p>
                    {snapshots.slice().reverse().map(snap => (
                      <div key={snap.id} className="bg-gray-800/50 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-purple-300">{snap.timeSlot}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${snap.confidence === 'high' ? 'bg-green-900/50 text-green-400' : snap.confidence === 'medium' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-red-900/50 text-red-400'}`}>
                              {snap.confidence}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-green-400 font-bold">¥{(snap.gpm || 0).toLocaleString()}</span>
                            <span className="text-gray-400 text-[10px]">GPM</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-1 mt-1.5">
                          <div className="text-center">
                            <p className="text-[9px] text-gray-500">派生GMV</p>
                            <p className="text-[10px] text-white">¥{(snap.gmv || 0).toLocaleString()}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[9px] text-gray-500">インプレ</p>
                            <p className="text-[10px] text-white">{snap.impressions ? `${(snap.impressions / 1000).toFixed(1)}K` : '-'}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[9px] text-gray-500">視聴者</p>
                            <p className="text-[10px] text-white">{snap.viewerCount ? `${(snap.viewerCount / 1000).toFixed(1)}K` : '-'}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[9px] text-gray-500">販売数</p>
                            <p className="text-[10px] text-white">{snap.orderCount || '-'}</p>
                          </div>
                        </div>
                        {(snap.tapThroughRate || snap.commentRate || snap.followRate) && (
                          <div className="flex gap-2 mt-1 text-[9px] text-gray-400">
                            {snap.tapThroughRate && <span>タップ:{snap.tapThroughRate}</span>}
                            {snap.commentRate && <span>コメント:{snap.commentRate}</span>}
                            {snap.followRate && <span>フォロー:{snap.followRate}</span>}
                          </div>
                        )}
                        {/* 商品リスト表示 */}
                        {(snap as any).products && (snap as any).products.length > 0 && (
                          <p className="text-[9px] text-purple-400 mt-1">📦 {(snap as any).products.length}件の商品を自動記録済み</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {snapshotTab === 'trend' && (
              <div>
                {trendChartData.length > 0 ? (
                  <div className="space-y-3">
                    {/* GPM推移チャート */}
                    <div>
                      <p className="text-xs text-gray-400 mb-2">GPM推移 (¥)</p>
                      <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trendChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="timeSlot" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                              labelStyle={{ color: '#fff', fontSize: 12 }}
                              itemStyle={{ fontSize: 11 }}
                            />
                            <Line type="monotone" dataKey="gpm" stroke="#a855f7" strokeWidth={2} dot={{ r: 4, fill: '#a855f7' }} name="GPM (¥)" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    {/* インプレ推移 */}
                    <div>
                      <p className="text-xs text-gray-400 mb-2">インプレッション (K)</p>
                      <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trendChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="timeSlot" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                              labelStyle={{ color: '#fff', fontSize: 12 }}
                              itemStyle={{ fontSize: 11 }}
                            />
                            <Line type="monotone" dataKey="impressions" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} name="インプレ (K)" />
                            <Line type="monotone" dataKey="viewers" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} name="視聴者 (K)" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <ImageIcon className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">スクショをアップロードすると、GPM推移チャートが表示されます</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>


      </div>
    </div>
  );
}


// ===== 福袋画像セクション =====
function LuckyBagSection({ livestreamId, liverId }: { livestreamId: number; liverId?: number | null }) {
  const luckyBagInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");

  const { data: luckyBagImages, refetch: refetchLuckyBags } = trpc.realtimeRecord.getLuckyBagImages.useQuery(
    { livestreamId },
    { enabled: livestreamId > 0 }
  );

  const uploadMutation = trpc.realtimeRecord.uploadLuckyBagImage.useMutation({
    onSuccess: (data) => {
      toast.success("福袋画像をアップロードしました！");
      refetchLuckyBags();
      setIsUploading(false);
      setTitle("");
      setPrice("");
    },
    onError: (err) => {
      toast.error(`アップロードエラー: ${err.message}`);
      setIsUploading(false);
    },
  });

  const deleteMutation = trpc.realtimeRecord.deleteLuckyBagImage.useMutation({
    onSuccess: () => {
      toast.success("福袋画像を削除しました");
      refetchLuckyBags();
    },
    onError: (err) => toast.error(`削除エラー: ${err.message}`),
  });

  const handleLuckyBagUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('画像ファイルを選択してください');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('ファイルサイズは10MB以下にしてください');
      return;
    }
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      const mimeType = file.type || 'image/png';
      uploadMutation.mutate({
        livestreamId,
        liverId: liverId || undefined,
        imageBase64: base64,
        mimeType,
        title: title || undefined,
        price: price ? parseInt(price) : undefined,
      });
    };
    reader.onerror = () => {
      toast.error('ファイル読み込みエラー');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
    if (luckyBagInputRef.current) luckyBagInputRef.current.value = '';
  };

  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardContent className="p-4">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Gift className="h-4 w-4 text-pink-400" />
          福袋画像
          {luckyBagImages && luckyBagImages.length > 0 && (
            <span className="text-[10px] bg-pink-900/50 text-pink-300 px-1.5 py-0.5 rounded">
              {luckyBagImages.length}枚
            </span>
          )}
        </h3>

        {/* アップロードフォーム */}
        <div className="space-y-2 mb-3">
          <div className="flex gap-2">
            <Input
              placeholder="福袋タイトル（例: ¥3,000福袋）"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 h-8 bg-gray-800 border-gray-600 text-white text-xs"
            />
            <Input
              placeholder="価格"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-20 h-8 bg-gray-800 border-gray-600 text-white text-xs"
            />
          </div>
          <input
            ref={luckyBagInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={handleLuckyBagUpload}
          />
          <Button
            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold h-10 text-sm"
            onClick={() => luckyBagInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />アップロード中...</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" />福袋画像をアップロード</>
            )}
          </Button>
        </div>

        {/* 画像一覧 */}
        {luckyBagImages && luckyBagImages.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {luckyBagImages.map((img) => (
              <div key={img.id} className="relative group bg-gray-800/50 rounded-lg overflow-hidden">
                <img
                  src={img.imageUrl}
                  alt={img.title || '福袋'}
                  className="w-full h-32 object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  {img.title && <p className="text-[10px] text-white font-bold truncate">{img.title}</p>}
                  {img.price && <p className="text-[10px] text-pink-300">¥{Number(img.price).toLocaleString()}</p>}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-1 right-1 h-6 w-6 p-0 bg-red-900/70 text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => {
                    if (confirm("この福袋画像を削除しますか？")) {
                      deleteMutation.mutate({ id: img.id });
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {(!luckyBagImages || luckyBagImages.length === 0) && (
          <div className="text-center py-4">
            <Gift className="h-6 w-6 text-gray-600 mx-auto mb-1" />
            <p className="text-[10px] text-gray-500">福袋画像をアップロードして配信中に使用しましょう</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
