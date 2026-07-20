import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Clock, ShoppingCart, Package, TrendingUp, Edit2, Check, X, Camera, Loader2, ImageIcon, Gift, Upload, BarChart2, TrendingDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import CsvSnapshotAnalysis from "@/components/CsvSnapshotAnalysis";
import ProductTimelineAnalysis from "@/components/ProductTimelineAnalysis";
// 30分刻みのタイムスロット生成
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    slots.push(`${h.toString().padStart(2, '0')}:30`);
  }
  return slots;
}

// 現在時刻を分単位で返す
function getCurrentTimeSlot(): string {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
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
  const [editTimeSlot, setEditTimeSlot] = useState("");
  const [editingSnapshotId, setEditingSnapshotId] = useState<number | null>(null);
  const [editSnapshotTime, setEditSnapshotTime] = useState("");

  // 商品候補（過去の記録から）
  const productSuggestions = useMemo(() => {
    if (!records) return [];
    const names = new Set(records.map(r => r.productName));
    return Array.from(names);
  }, [records]);

  // CSV比較ダイアログ用state
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [compareProductName, setCompareProductName] = useState("");
  const [compareProductRecords, setCompareProductRecords] = useState<any[]>([]);
  const [csvSearchQuery, setCsvSearchQuery] = useState("");
  const [expandedRecordIds, setExpandedRecordIds] = useState<Set<number>>(new Set());

  // CSV最新スナップショットの商品データ取得
  const { data: csvSnapshotsForCompare } = trpc.csvSnapshot.getCsvSnapshots.useQuery(
    { livestreamId },
    { enabled: livestreamId > 0 }
  );
  const latestSnapshotId = useMemo(() => {
    if (!csvSnapshotsForCompare || csvSnapshotsForCompare.length === 0) return 0;
    return csvSnapshotsForCompare[csvSnapshotsForCompare.length - 1].id;
  }, [csvSnapshotsForCompare]);
  const { data: csvProductsForCompare } = trpc.csvSnapshot.getCsvSnapshotProducts.useQuery(
    { snapshotId: latestSnapshotId },
    { enabled: latestSnapshotId > 0 }
  );

  // CSV商品から名前で検索（部分一致）
  const findCsvProduct = (name: string) => {
    if (!csvProductsForCompare || !name) return null;
    // まず完全一致
    const exact = csvProductsForCompare.find(p => p.productName === name);
    if (exact) return exact;
    // 部分一致（商品名の先頭部分）
    const partial = csvProductsForCompare.find(p => 
      p.productName.includes(name) || name.includes(p.productName)
    );
    return partial || null;
  };

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

  const updateSnapshotTimeMutation = trpc.realtimeRecord.updateSnapshotTimeSlot.useMutation({
    onSuccess: () => {
      toast.success("時間を更新しました");
      setEditingSnapshotId(null);
      refetchSnapshots();
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
    processSnapshotFile(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 共通のファイル処理関数
  const processSnapshotFile = (file: File) => {
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
  };

  // ペースト（Ctrl+V）で画像アップロード
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) {
            toast.info('クリップボードから画像を検出しました。AI解析中...');
            processSnapshotFile(file);
          }
          return;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [livestreamId, livestream?.liverId, timeSlot, notes]);

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

  // timeSlots no longer needed - using native time input

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
                          <p className="text-xs text-white font-medium">{item.productName}</p>
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
              <input
                type="time"
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white h-9 rounded-md px-3 text-sm font-mono"
              />
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

            {/* メモ（任意）- 商品情報と分離 */}
            <div className="pt-2 border-t border-gray-700/50">
              <label className="text-[10px] text-gray-400 mb-1 block">📝 メモ（商品情報とは別）</label>
              <Input
                placeholder="話術、反応、気づきなど自由に記入..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white h-9 text-sm"
              />
            </div>

            {/* 記録ボタン */}
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12 text-base"
              onClick={handleAdd}
              disabled={addMutation.isPending}
            >
              <Plus className="h-5 w-5 mr-2" />
              {addMutation.isPending ? "記録中..." : "記録する"}
            </Button>

            {/* 商品記録一覧（商品名でグループ化・各時間帯のデータを表示） */}
            {records && records.length > 0 && (() => {
              // Group records by product name
              const grouped = records.reduce((acc: Record<string, typeof records>, record: any) => {
                const name = record.productName;
                if (!acc[name]) acc[name] = [];
                acc[name].push(record);
                return acc;
              }, {} as Record<string, typeof records>);
              const productNames = Object.keys(grouped);
              return (
                <div className="mt-6 pt-4 border-t border-gray-700">
                  <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-green-400" />
                    商品記録 ({productNames.length}商品 / {records.length}件)
                  </h4>
                  <p className="text-[10px] text-gray-400 mb-3">※ 左の<span className="text-blue-300 font-mono">時刻</span>は記録した時間（HH:MM形式）です。クリックで編集できます。</p>
                  <div className="space-y-4">
                    {productNames.map(productName => {
                      const productRecords = grouped[productName];
                      const latestRecord = productRecords[0]; // sorted by newest first
                      return (
                        <div key={productName} className="bg-gray-800/60 border border-gray-700 rounded-lg">
                          {/* Product header */}
                          <div className="px-4 py-3 bg-gray-800/80 border-b border-gray-700 flex flex-wrap items-center justify-between gap-2">
                            <div className="w-full">
                              <span className="text-base font-bold text-white">{productName}</span>
                              {productRecords.length > 1 && (
                                <span className="ml-2 text-xs text-gray-400">({productRecords.length}回記録)</span>
                              )}
                              {/* 記録者表示 */}
                              {productRecords[0]?.recordedBy && (
                                <span className="ml-2 text-[10px] text-purple-300 bg-purple-900/30 px-1.5 py-0.5 rounded">👤 {productRecords[0].recordedBy}</span>
                              )}
                            </div>
                            {csvProductsForCompare && csvProductsForCompare.length > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[10px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30 gap-1"
                                onClick={() => {
                                  setCompareProductName(productName);
                                  setCompareProductRecords(productRecords);
                                  setCompareDialogOpen(true);
                                }}
                              >
                                <BarChart2 className="h-3.5 w-3.5" />
                                CSV比較
                              </Button>
                            )}
                          </div>
                          {/* Time-point data rows */}
                          <div className="divide-y divide-gray-700/50">
                            {productRecords.map(record => (
                              <div key={record.id} className="px-4 py-2.5">
                                {editingId === record.id ? (
                                  /* 編集モード */
                                  <div className="space-y-2">
                                    <Input
                                      value={editProductName}
                                      onChange={(e) => setEditProductName(e.target.value)}
                                      placeholder="商品名"
                                      className="bg-gray-700 border-gray-600 text-white text-sm h-9"
                                    />
                                    <div className="grid grid-cols-4 gap-2">
                                      <div>
                                        <label className="text-[10px] text-gray-400">時間</label>
                                        <Input
                                          type="time"
                                          value={editTimeSlot}
                                          onChange={(e) => setEditTimeSlot(e.target.value)}
                                          className="bg-gray-700 border-gray-600 text-white text-sm h-8"
                                        />
                                      </div>
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
                                            timeSlot: editTimeSlot || undefined,
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
                                  /* 表示モード - コンパクト表示 + タップで展開 */
                                  <div
                                    className="cursor-pointer select-none"
                                    onClick={(e) => {
                                      // 編集・削除ボタンのクリックは除外
                                      if ((e.target as HTMLElement).closest('button')) return;
                                      setExpandedRecordIds(prev => {
                                        const next = new Set(prev);
                                        if (next.has(record.id)) next.delete(record.id);
                                        else next.add(record.id);
                                        return next;
                                      });
                                    }}
                                  >
                                    {/* メイン行: 時間 + 出単 + カート + GMV（コンパクト） */}
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                                        <span
                                          className="text-xs font-mono text-blue-300 bg-blue-900/30 px-2 py-0.5 rounded min-w-[50px] text-center cursor-pointer hover:bg-blue-800/50 hover:text-blue-100"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingId(record.id);
                                            setEditProductName(record.productName);
                                            setEditPrice(record.productPrice ? String(record.productPrice) : '0');
                                            setEditQuantity(String(record.quantitySold));
                                            setEditCartAdd(String(record.cartAddCount || 0));
                                            setEditTimeSlot(record.timeSlot || '');
                                            setEditNotes(record.notes || '');
                                          }}
                                          title="記録時刻（クリックで編集）"
                                        >{record.timeSlot}</span>
                                        {record.productPrice && (
                                          <span className="text-sm text-gray-300">単価: <span className="text-green-400 font-bold">¥{Number(record.productPrice).toLocaleString()}</span></span>
                                        )}
                                        <span className="text-sm text-gray-300">出単: <span className="text-yellow-400 font-bold">{record.quantitySold}件</span></span>
                                        {(record.cartAddCount || 0) > 0 && (
                                          <span className="text-sm text-gray-300">カート: <span className="text-amber-400 font-bold">{record.cartAddCount}</span></span>
                                        )}
                                        {/* GMVだけ常に表示（AI解析データから） */}
                                        {record.notes && (() => {
                                          const lines = record.notes.split('\n');
                                          const aiLine = lines.find((l: string) => l.startsWith('[AI]'));
                                          if (!aiLine) return null;
                                          const gmvMatch = aiLine.match(/GMV[：:]([^/]+)/);
                                          if (!gmvMatch) return null;
                                          return (
                                            <span className="inline-flex items-center gap-0.5 text-[11px] bg-emerald-900/40 border border-emerald-700/50 rounded px-1.5 py-0.5">
                                              <span className="text-gray-400">GMV:</span>
                                              <span className="text-emerald-300 font-medium">{gmvMatch[1].trim()}</span>
                                            </span>
                                          );
                                        })()}
                                      </div>
                                      <div className="flex items-center gap-1 ml-2 shrink-0">
                                        {/* 展開インジケーター */}
                                        {record.notes && record.notes.includes('[AI]') && (
                                          <span className={`text-gray-500 text-xs transition-transform duration-200 ${expandedRecordIds.has(record.id) ? 'rotate-180' : ''}`}>▼</span>
                                        )}
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 w-7 p-0 text-gray-400 hover:text-blue-400"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingId(record.id);
                                            setEditProductName(record.productName);
                                            setEditPrice(record.productPrice ? String(record.productPrice) : '0');
                                            setEditQuantity(String(record.quantitySold));
                                            setEditCartAdd(String(record.cartAddCount || 0));
                                            setEditTimeSlot(record.timeSlot || '');
                                            setEditNotes(record.notes || '');
                                          }}
                                        >
                                          <Edit2 className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 w-7 p-0 text-gray-400 hover:text-red-400"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm("この記録を削除しますか？")) {
                                              deleteMutation.mutate({ id: record.id });
                                            }
                                          }}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                    {/* 展開時: AI解析データの詳細 */}
                                    {expandedRecordIds.has(record.id) && record.notes && (() => {
                                      const lines = record.notes.split('\n');
                                      const aiLine = lines.find((l: string) => l.startsWith('[AI]'));
                                      if (!aiLine) return null;
                                      const aiData = aiLine.replace('[AI] ', '').replace('[AI]', '');
                                      const parts = aiData.split(' / ');
                                      return (
                                        <div className="mt-2 ml-[58px] p-2 bg-gray-800/50 rounded-md border border-gray-700/30">
                                          <div className="flex flex-wrap gap-1.5">
                                            {parts.map((part: string, idx: number) => {
                                              const colonIdx = part.indexOf(':');
                                              if (colonIdx <= 0) return null;
                                              const label = part.substring(0, colonIdx);
                                              const value = part.substring(colonIdx + 1);
                                              return (
                                                <span key={idx} className="inline-flex items-center gap-0.5 text-[11px] bg-gray-700/60 border border-gray-600/50 rounded px-1.5 py-0.5">
                                                  <span className="text-gray-400">{label.trim()}:</span>
                                                  <span className="text-cyan-300 font-medium">{value.trim()}</span>
                                                </span>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })()}
                                    {/* メモ表示 */}
                                    {record.notes && (() => {
                                      const lines = record.notes.split('\n');
                                      const userComment = lines.filter((l: string) => !l.startsWith('[AI]') && l.trim() !== '' && l !== '[AI解析]').join(' ');
                                      if (!userComment) return null;
                                      return (
                                        <div className="mt-1.5 ml-[58px] pl-2 border-l-2 border-gray-700/50">
                                          <p className="text-xs text-gray-400">📝 {userComment}</p>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* 📊 商品タイムライン分析（スナップショットデータから） */}
        {snapshots && snapshots.length >= 2 && (
          <ProductTimelineAnalysis snapshots={snapshots} />
        )}

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
                <p className="text-[10px] text-purple-400 text-center font-medium">
                  📋 Ctrl+V でクリップボードから直接ペーストもOK
                </p>

                {/* スクショ履歴 */}
                {snapshots && snapshots.length > 0 && (
                  <div className="space-y-3 mt-3">
                    <p className="text-xs text-gray-400 font-bold">解析履歴 ({snapshots.length}件)</p>
                    {snapshots.slice().reverse().map(snap => {
                      // 商品リストからGMV合算を計算（表示用）
                      const products = (snap as any).products || [];
                      const productsGmvTotal = products.reduce((sum: number, p: any) => sum + (p.attributedGmv || 0), 0);
                      const productsTotalOrders = products.reduce((sum: number, p: any) => sum + (p.salesCount || 0), 0);
                      const displayGmv = snap.gmv || productsGmvTotal;
                      const displayOrders = snap.orderCount || productsTotalOrders;
                      return (
                      <div key={snap.id} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                        {/* ヘッダー: 時刻 + 信頼度 + GPM */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {editingSnapshotId === snap.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="time"
                                  value={editSnapshotTime}
                                  onChange={(e) => setEditSnapshotTime(e.target.value)}
                                  className="bg-gray-700 border border-gray-600 text-white text-xs font-mono rounded px-1.5 py-0.5 w-[80px]"
                                />
                                <button
                                  onClick={() => {
                                    updateSnapshotTimeMutation.mutate({ id: snap.id, timeSlot: editSnapshotTime });
                                  }}
                                  className="text-green-400 hover:text-green-300 text-xs"
                                >✓</button>
                                <button
                                  onClick={() => setEditingSnapshotId(null)}
                                  className="text-gray-400 hover:text-gray-300 text-xs"
                                >✗</button>
                              </div>
                            ) : (
                              <span
                                className="text-sm font-bold font-mono text-purple-300 cursor-pointer hover:text-purple-100 hover:underline"
                                onClick={() => {
                                  setEditingSnapshotId(snap.id);
                                  setEditSnapshotTime(snap.timeSlot);
                                }}
                                title="クリックで時間を編集"
                              >{snap.timeSlot}</span>
                            )}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${snap.confidence === 'high' ? 'bg-green-900/50 text-green-400' : snap.confidence === 'medium' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-red-900/50 text-red-400'}`}>
                              {snap.confidence}
                            </span>
                          </div>
                          {snap.gpm ? (
                            <div className="flex items-center gap-1">
                              <span className="text-green-400 font-bold text-sm">¥{snap.gpm.toLocaleString()}</span>
                              <span className="text-gray-500 text-[10px]">GPM</span>
                            </div>
                          ) : null}
                        </div>

                        {/* スクショサムネイル */}
                        {(snap as any).imageUrl && (
                          <div className="mb-2">
                            <img
                              src={(snap as any).imageUrl}
                              alt={`スクショ ${snap.timeSlot}`}
                              className="w-full max-h-48 object-contain rounded-md border border-gray-600 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => window.open((snap as any).imageUrl, '_blank')}
                            />
                          </div>
                        )}

                        {/* 指標グリッド */}
                        <div className="grid grid-cols-4 gap-2 mt-2 bg-gray-900/50 rounded-md p-2">
                          <div className="text-center">
                            <p className="text-[10px] text-gray-500 mb-0.5">派生GMV</p>
                            <p className={`text-xs font-bold ${displayGmv > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                              {displayGmv > 0 ? `¥${displayGmv.toLocaleString()}` : '¥0'}
                            </p>
                            {!snap.gmv && productsGmvTotal > 0 && (
                              <p className="text-[8px] text-gray-600">(商品合算)</p>
                            )}
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-gray-500 mb-0.5">インプレ</p>
                            <p className="text-xs font-bold text-white">{snap.impressions ? `${(snap.impressions / 1000).toFixed(1)}K` : '-'}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-gray-500 mb-0.5">視聴者</p>
                            <p className="text-xs font-bold text-white">{snap.viewerCount ? `${(snap.viewerCount / 1000).toFixed(1)}K` : '-'}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-gray-500 mb-0.5">販売数</p>
                            <p className={`text-xs font-bold ${displayOrders > 0 ? 'text-white' : 'text-gray-500'}`}>
                              {displayOrders > 0 ? displayOrders.toLocaleString() : '-'}
                            </p>
                            {!snap.orderCount && productsTotalOrders > 0 && (
                              <p className="text-[8px] text-gray-600">(商品合算)</p>
                            )}
                          </div>
                        </div>

                        {/* 追加指標（タップ率等） */}
                        {(snap.tapThroughRate || snap.commentRate || snap.followRate || snap.avgViewDuration) && (
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-gray-400">
                            {snap.tapThroughRate && <span>📱 タップ率: <span className="text-white">{snap.tapThroughRate}</span></span>}
                            {snap.commentRate && <span>💬 コメント率: <span className="text-white">{snap.commentRate}</span></span>}
                            {snap.followRate && <span>➕ フォロー率: <span className="text-white">{snap.followRate}</span></span>}
                            {snap.avgViewDuration && <span>⏱ 平均視聴: <span className="text-white">{snap.avgViewDuration}</span></span>}
                          </div>
                        )}

                        {/* 商品リスト表示 */}
                        {products.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-700/50">
                            <p className="text-[10px] text-purple-400 font-medium">📦 {products.length}件の商品を自動記録済み</p>
                          </div>
                        )}
                      </div>
                    );})}
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
        {/* 📊 CSV/Excel商品分析セクション */}
        <CsvSnapshotAnalysis livestreamId={livestreamId} liverId={livestream?.liverId} timeSlot={timeSlot} onProductsAdded={() => refetch()} />

        {/* CSV比較ダイアログ */}
        <Dialog open={compareDialogOpen} onOpenChange={(open) => { setCompareDialogOpen(open); if (!open) setCsvSearchQuery(''); }}>
          <DialogContent className="max-w-4xl w-[90vw] bg-gray-900 border-gray-700 text-white max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-emerald-400" />
                CSV最終データとの比較
              </DialogTitle>
            </DialogHeader>
            {(() => {
              const csvProduct = findCsvProduct(compareProductName);
              if (!csvProduct) {
                const filteredProducts = csvProductsForCompare?.filter(p => {
                  if (!csvSearchQuery) return true;
                  return p.productName.toLowerCase().includes(csvSearchQuery.toLowerCase());
                }) || [];
                return (
                  <div className="py-4">
                    <p className="text-gray-400 text-sm text-center">「{compareProductName}」に一致するCSV商品が見つかりません</p>
                    <p className="text-gray-500 text-xs mt-2 text-center">以下のCSV商品から選択してください：</p>
                    {/* 検索ボックス */}
                    <div className="mt-3 mb-2">
                      <Input
                        placeholder="商品名で検索..."
                        value={csvSearchQuery}
                        onChange={(e) => setCsvSearchQuery(e.target.value)}
                        className="bg-gray-800 border-gray-600 text-white text-sm h-9"
                      />
                    </div>
                    <div className="max-h-[400px] overflow-y-auto space-y-1">
                      {filteredProducts.map(p => (
                        <div
                          key={p.id}
                          className="text-left px-3 py-2.5 bg-gray-800/50 rounded cursor-pointer hover:bg-emerald-900/30 transition-colors border border-transparent hover:border-emerald-700/50"
                          onClick={() => {
                            setCompareProductName(p.productName);
                            setCsvSearchQuery('');
                          }}
                        >
                          <p className="text-sm text-white">{p.productName}</p>
                          <div className="flex gap-3 mt-1">
                            <span className="text-[10px] text-green-400">GMV:¥{Number(p.gmv || 0).toLocaleString()}</span>
                            <span className="text-[10px] text-blue-400">注文:{p.orderCount || 0}件</span>
                            <span className="text-[10px] text-amber-400">GPM:¥{Number(p.gpm || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                      {filteredProducts.length === 0 && (
                        <p className="text-center text-gray-500 text-xs py-4">該当する商品がありません</p>
                      )}
                    </div>
                  </div>
                );
              }

              // CSV最終データ
              const csvGmv = Number(csvProduct.gmv) || 0;
              const csvOrders = Number(csvProduct.orderCount) || 0;
              const csvImpressions = Number(csvProduct.impressionCount) || 0;
              const csvClickRate = Number(csvProduct.clickRate) || 0;
              const csvGpm = Number(csvProduct.gpm) || 0;
              const csvSkuConv = Number(csvProduct.skuConversionRate) || 0;
              const csvCartAdd = Number(csvProduct.cartAddCount) || 0;
              const csvClickCount = Number(csvProduct.clickCount) || 0;
              const csvUnitPrice = csvOrders > 0 ? Math.round(csvGmv / csvOrders) : 0;

              // 手動記録の最新データ
              const latestManual = compareProductRecords[0];
              const manualPrice = latestManual ? Number(latestManual.productPrice) || 0 : 0;
              const manualQuantity = latestManual ? latestManual.quantitySold || 0 : 0;
              const manualCart = latestManual ? latestManual.cartAddCount || 0 : 0;
              const manualGmv = manualPrice * manualQuantity;

              return (
                <div className="space-y-4">
                  {/* 商品名 */}
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">CSV商品名</p>
                    <p className="text-sm text-white font-medium">{csvProduct.productName}</p>
                  </div>

                  {/* 比較テーブル */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-2 px-2 text-gray-400 font-normal">指標</th>
                          <th className="text-right py-2 px-2 text-blue-400 font-normal">手動記録 (最新)</th>
                          <th className="text-right py-2 px-2 text-emerald-400 font-normal">CSV最終データ</th>
                          <th className="text-right py-2 px-2 text-gray-400 font-normal">差分</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700/50">
                        <tr>
                          <td className="py-2 px-2 text-gray-300">単価</td>
                          <td className="py-2 px-2 text-right text-white">¥{manualPrice.toLocaleString()}</td>
                          <td className="py-2 px-2 text-right text-white">¥{csvUnitPrice.toLocaleString()}</td>
                          <td className="py-2 px-2 text-right">
                            {csvUnitPrice - manualPrice !== 0 && (
                              <span className={csvUnitPrice - manualPrice > 0 ? 'text-green-400' : 'text-red-400'}>
                                {csvUnitPrice - manualPrice > 0 ? '+' : ''}¥{(csvUnitPrice - manualPrice).toLocaleString()}
                              </span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 px-2 text-gray-300">出単数</td>
                          <td className="py-2 px-2 text-right text-white">{manualQuantity}件</td>
                          <td className="py-2 px-2 text-right text-white">{csvOrders}件</td>
                          <td className="py-2 px-2 text-right">
                            {csvOrders - manualQuantity !== 0 && (
                              <span className={csvOrders - manualQuantity > 0 ? 'text-green-400' : 'text-red-400'}>
                                {csvOrders - manualQuantity > 0 ? '+' : ''}{csvOrders - manualQuantity}件
                              </span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 px-2 text-gray-300">カート</td>
                          <td className="py-2 px-2 text-right text-white">{manualCart}</td>
                          <td className="py-2 px-2 text-right text-white">{csvCartAdd}</td>
                          <td className="py-2 px-2 text-right">
                            {csvCartAdd - manualCart !== 0 && (
                              <span className={csvCartAdd - manualCart > 0 ? 'text-green-400' : 'text-red-400'}>
                                {csvCartAdd - manualCart > 0 ? '+' : ''}{csvCartAdd - manualCart}
                              </span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 px-2 text-gray-300">GMV</td>
                          <td className="py-2 px-2 text-right text-white">¥{manualGmv.toLocaleString()}</td>
                          <td className="py-2 px-2 text-right text-white">¥{csvGmv.toLocaleString()}</td>
                          <td className="py-2 px-2 text-right">
                            {csvGmv - manualGmv !== 0 && (
                              <span className={csvGmv - manualGmv > 0 ? 'text-green-400' : 'text-red-400'}>
                                {csvGmv - manualGmv > 0 ? '+' : ''}¥{(csvGmv - manualGmv).toLocaleString()}
                              </span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* CSV追加指標 */}
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-xs text-gray-400 font-bold mb-2">CSV最終データ詳細</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {csvImpressions > 0 && (
                        <div className="bg-gray-700/50 rounded px-2 py-1.5">
                          <p className="text-[9px] text-gray-500">曝光</p>
                          <p className="text-xs text-white font-medium">{csvImpressions.toLocaleString()}</p>
                        </div>
                      )}
                      {csvClickCount > 0 && (
                        <div className="bg-gray-700/50 rounded px-2 py-1.5">
                          <p className="text-[9px] text-gray-500">クリック</p>
                          <p className="text-xs text-white font-medium">{csvClickCount.toLocaleString()}</p>
                        </div>
                      )}
                      {csvClickRate > 0 && (
                        <div className="bg-gray-700/50 rounded px-2 py-1.5">
                          <p className="text-[9px] text-gray-500">クリック率</p>
                          <p className="text-xs text-cyan-400 font-medium">{(csvClickRate * 100).toFixed(2)}%</p>
                        </div>
                      )}
                      {csvSkuConv > 0 && (
                        <div className="bg-gray-700/50 rounded px-2 py-1.5">
                          <p className="text-[9px] text-gray-500">SKU転化率</p>
                          <p className="text-xs text-purple-400 font-medium">{(csvSkuConv * 100).toFixed(2)}%</p>
                        </div>
                      )}
                      {csvGpm > 0 && (
                        <div className="bg-gray-700/50 rounded px-2 py-1.5">
                          <p className="text-[9px] text-gray-500">千次観看</p>
                          <p className="text-xs text-amber-400 font-medium">¥{csvGpm.toLocaleString()}</p>
                        </div>
                      )}
                      {Number(csvProduct.availableStock) > 0 && (
                        <div className="bg-gray-700/50 rounded px-2 py-1.5">
                          <p className="text-[9px] text-gray-500">在庫</p>
                          <p className={`text-xs font-medium ${Number(csvProduct.availableStock) <= 5 ? 'text-red-400' : 'text-white'}`}>{csvProduct.availableStock}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 時系列比較（手動記録の各時間帯 vs CSV最終） */}
                  {compareProductRecords.length > 1 && (
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 font-bold mb-2">時系列変化（手動記録 → CSV最終）</p>
                      <div className="space-y-1">
                        {compareProductRecords.map((rec, idx) => {
                          const recGmv = (Number(rec.productPrice) || 0) * (rec.quantitySold || 0);
                          return (
                            <div key={rec.id} className="flex items-center justify-between bg-gray-700/30 rounded px-2 py-1.5">
                              <span className="text-[10px] font-mono text-blue-300">{rec.timeSlot}</span>
                              <div className="flex items-center gap-3 text-[10px]">
                                <span className="text-gray-300">出単:{rec.quantitySold}件</span>
                                <span className="text-gray-300">カート:{rec.cartAddCount || 0}</span>
                                <span className="text-green-400">GMV:¥{recGmv.toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        })}
                        {/* CSV最終データ行 */}
                        <div className="flex items-center justify-between bg-emerald-900/30 border border-emerald-700/50 rounded px-2 py-1.5">
                          <span className="text-[10px] font-mono text-emerald-300">最終(CSV)</span>
                          <div className="flex items-center gap-3 text-[10px]">
                            <span className="text-emerald-300">出単:{csvOrders}件</span>
                            <span className="text-emerald-300">カート:{csvCartAdd}</span>
                            <span className="text-emerald-400 font-bold">GMV:¥{csvGmv.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

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
