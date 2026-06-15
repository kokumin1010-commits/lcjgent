/**
 * 24H爆速商品ラボ - メイン管理画面
 * 高速回転商品テストシステム
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  FlaskConical, Plus, Search, Send, Megaphone, BarChart3,
  Package, TrendingUp, Zap, AlertTriangle, CheckCircle2,
  ArrowRight, Users, Eye, ShoppingCart, DollarSign
} from "lucide-react";

// ステータスラベルと色
const STATUS_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  candidate: { label: "候補", color: "bg-slate-500", emoji: "📋" },
  testing: { label: "テスト中", color: "bg-blue-500", emoji: "🧪" },
  hit: { label: "爆品", color: "bg-orange-500", emoji: "🔥" },
  spreading: { label: "横推中", color: "bg-purple-500", emoji: "📡" },
  standard: { label: "定番", color: "bg-green-500", emoji: "✅" },
  eliminated: { label: "淘汰", color: "bg-red-500", emoji: "❌" },
};

export default function ProductLab() {

  const [activeTab, setActiveTab] = useState("pipeline");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showBroadcastDialog, setShowBroadcastDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // フォーム状態
  const [newProduct, setNewProduct] = useState({
    name: "", imageUrl: "", sourceUrl: "", sourceType: "manual" as const,
    costPrice: "", sellPrice: "", category: "", talkScript: "", productDescription: "", notes: "",
  });
  const [assignLiverId, setAssignLiverId] = useState<number | null>(null);
  const [assignDuration, setAssignDuration] = useState(5);
  const [broadcastMessage, setBroadcastMessage] = useState("");

  // API呼び出し
  const productsQuery = trpc.productLab.list.useQuery({
    status: statusFilter as any,
    search: searchQuery || undefined,
    page: 1,
    limit: 100,
  });
  const statsQuery = trpc.productLab.stats.useQuery();
  const liversQuery = trpc.productLab.getLivers.useQuery();

  const createMutation = trpc.productLab.create.useMutation({
    onSuccess: () => {
      toast.success("商品を登録しました");
      setShowCreateDialog(false);
      setNewProduct({ name: "", imageUrl: "", sourceUrl: "", sourceType: "manual", costPrice: "", sellPrice: "", category: "", talkScript: "", productDescription: "", notes: "" });
      productsQuery.refetch();
      statsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateStatusMutation = trpc.productLab.updateStatus.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      productsQuery.refetch();
      statsQuery.refetch();
    },
  });

  const assignMutation = trpc.productLab.assignTest.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setShowAssignDialog(false);
      productsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const broadcastMutation = trpc.productLab.broadcastHit.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setShowBroadcastDialog(false);
      productsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.productLab.delete.useMutation({
    onSuccess: () => {
      toast.success("削除しました");
      productsQuery.refetch();
      statsQuery.refetch();
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* ヘッダー */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
            <FlaskConical className="h-7 w-7 text-pink-500" />
            24H爆速商品ラボ
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            1688仕入れ → テスト配信 → 爆品判定 → 全主播横推
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white shadow-lg"
          >
            <Plus className="h-4 w-4 mr-1" /> 商品登録
          </Button>
        </div>
      </div>

      {/* 統計カード */}
      {statsQuery.data && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <Card key={key} className="relative overflow-hidden">
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">{config.emoji} {config.label}</div>
                <div className="text-2xl font-bold mt-1">
                  {statsQuery.data.statusCounts[key as keyof typeof statsQuery.data.statusCounts]}
                </div>
              </CardContent>
              <div className={`absolute bottom-0 left-0 right-0 h-1 ${config.color}`} />
            </Card>
          ))}
        </div>
      )}

      {/* メインコンテンツ */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pipeline" className="flex items-center gap-1">
            <Package className="h-4 w-4" /> パイプライン
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" /> データ看板
          </TabsTrigger>
          <TabsTrigger value="broadcast" className="flex items-center gap-1">
            <Megaphone className="h-4 w-4" /> 横推管理
          </TabsTrigger>
        </TabsList>

        {/* パイプラインタブ */}
        <TabsContent value="pipeline" className="space-y-4">
          {/* フィルター */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="商品名で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="ステータス" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全て</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.emoji} {config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 商品リスト */}
          <div className="grid gap-3">
            {productsQuery.isLoading && (
              <div className="text-center py-10 text-muted-foreground">読み込み中...</div>
            )}
            {productsQuery.data?.items.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                商品がありません。「商品登録」から追加してください。
              </div>
            )}
            {productsQuery.data?.items.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onStatusChange={(status) => updateStatusMutation.mutate({ id: product.id, status })}
                onAssign={() => { setSelectedProduct(product); setShowAssignDialog(true); }}
                onBroadcast={() => { setSelectedProduct(product); setShowBroadcastDialog(true); }}
                onDelete={() => {
                  if (confirm("この商品を削除しますか？")) {
                    deleteMutation.mutate({ id: product.id });
                  }
                }}
              />
            ))}
          </div>
        </TabsContent>

        {/* データ看板タブ */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-orange-500" /> 累計販売数
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {statsQuery.data?.topProducts.reduce((sum, p) => sum + (p.totalSales || 0), 0).toLocaleString() || "0"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-500" /> 累計GMV
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  ¥{(statsQuery.data?.totalGmv || 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-500" /> 商品数
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {statsQuery.data?.totalProducts || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* トップ商品ランキング */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" /> スコアランキング TOP10
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {statsQuery.data?.topProducts.map((product, idx) => (
                  <div key={product.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? "bg-yellow-500 text-white" :
                      idx === 1 ? "bg-gray-400 text-white" :
                      idx === 2 ? "bg-amber-700 text-white" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{product.name}</div>
                      <div className="text-xs text-muted-foreground">
                        スコア: {product.score} | 転換率: {product.conversionRate}% | 販売: {product.totalSales}個
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {STATUS_CONFIG[product.status]?.emoji} {STATUS_CONFIG[product.status]?.label}
                    </Badge>
                  </div>
                ))}
                {(!statsQuery.data?.topProducts || statsQuery.data.topProducts.length === 0) && (
                  <div className="text-center py-6 text-muted-foreground">
                    まだデータがありません
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 横推管理タブ */}
        <TabsContent value="broadcast" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-purple-500" /> 横推対象商品（爆品）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {productsQuery.data?.items
                  .filter(p => p.status === "hit" || p.status === "spreading")
                  .map(product => (
                    <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-muted-foreground">
                          スコア: {product.score} | GMV: ¥{Number(product.totalGmv).toLocaleString()}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={product.status === "spreading" ? "outline" : "default"}
                        className={product.status !== "spreading" ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white" : ""}
                        onClick={() => { setSelectedProduct(product); setShowBroadcastDialog(true); }}
                      >
                        <Megaphone className="h-4 w-4 mr-1" />
                        {product.status === "spreading" ? "再通知" : "横推開始"}
                      </Button>
                    </div>
                  ))}
                {productsQuery.data?.items.filter(p => p.status === "hit" || p.status === "spreading").length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    爆品がまだありません。テスト配信で高スコアの商品を「爆品」に変更してください。
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 商品登録ダイアログ */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" /> 新商品登録
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">商品名 *</label>
              <Input
                value={newProduct.name}
                onChange={(e) => setNewProduct(p => ({ ...p, name: e.target.value }))}
                placeholder="例: 美容液セラム 30ml"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">原価（仕入値）*</label>
                <Input
                  type="number"
                  value={newProduct.costPrice}
                  onChange={(e) => setNewProduct(p => ({ ...p, costPrice: e.target.value }))}
                  placeholder="100"
                />
              </div>
              <div>
                <label className="text-sm font-medium">売値 *</label>
                <Input
                  type="number"
                  value={newProduct.sellPrice}
                  onChange={(e) => setNewProduct(p => ({ ...p, sellPrice: e.target.value }))}
                  placeholder="900"
                />
              </div>
            </div>
            {newProduct.costPrice && newProduct.sellPrice && (
              <div className="text-sm p-2 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400">
                💰 利益率: {((parseFloat(newProduct.sellPrice) - parseFloat(newProduct.costPrice)) / parseFloat(newProduct.sellPrice) * 100).toFixed(1)}%
                （利益: ¥{(parseFloat(newProduct.sellPrice) - parseFloat(newProduct.costPrice)).toFixed(0)}/個）
              </div>
            )}
            <div>
              <label className="text-sm font-medium">仕入れURL（1688/AliExpress）</label>
              <Input
                value={newProduct.sourceUrl}
                onChange={(e) => setNewProduct(p => ({ ...p, sourceUrl: e.target.value }))}
                placeholder="https://detail.1688.com/..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">商品画像URL</label>
              <Input
                value={newProduct.imageUrl}
                onChange={(e) => setNewProduct(p => ({ ...p, imageUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">カテゴリ</label>
              <Input
                value={newProduct.category}
                onChange={(e) => setNewProduct(p => ({ ...p, category: e.target.value }))}
                placeholder="例: 美容, 食品, 雑貨"
              />
            </div>
            <div>
              <label className="text-sm font-medium">話術テンプレート（主播用）</label>
              <Textarea
                value={newProduct.talkScript}
                onChange={(e) => setNewProduct(p => ({ ...p, talkScript: e.target.value }))}
                placeholder="この商品のセールスポイント、話し方のコツなど..."
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium">商品説明</label>
              <Textarea
                value={newProduct.productDescription}
                onChange={(e) => setNewProduct(p => ({ ...p, productDescription: e.target.value }))}
                placeholder="商品の特徴、使い方など..."
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium">メモ</label>
              <Textarea
                value={newProduct.notes}
                onChange={(e) => setNewProduct(p => ({ ...p, notes: e.target.value }))}
                placeholder="内部メモ..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">キャンセル</Button>
            </DialogClose>
            <Button
              onClick={() => createMutation.mutate(newProduct)}
              disabled={!newProduct.name || !newProduct.costPrice || !newProduct.sellPrice || createMutation.isPending}
              className="bg-gradient-to-r from-orange-500 to-pink-500 text-white"
            >
              {createMutation.isPending ? "登録中..." : "登録"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* テスト配信アサインダイアログ */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" /> テスト配信アサイン
            </DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-accent/50">
                <div className="font-medium">{selectedProduct.name}</div>
                <div className="text-sm text-muted-foreground">
                  売値: ¥{selectedProduct.sellPrice}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">主播を選択 *</label>
                <Select onValueChange={(v) => setAssignLiverId(Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="主播を選んでください" />
                  </SelectTrigger>
                  <SelectContent>
                    {liversQuery.data?.map(liver => (
                      <SelectItem key={liver.id} value={String(liver.id)}>
                        {liver.name} {liver.lineUserId ? "✅LINE" : "⚠️LINE未連携"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">配信時間（分）</label>
                <Input
                  type="number"
                  value={assignDuration}
                  onChange={(e) => setAssignDuration(Number(e.target.value))}
                  min={1}
                  max={60}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">キャンセル</Button>
            </DialogClose>
            <Button
              onClick={() => {
                if (selectedProduct && assignLiverId) {
                  assignMutation.mutate({
                    productId: selectedProduct.id,
                    liverId: assignLiverId,
                    durationMinutes: assignDuration,
                  });
                }
              }}
              disabled={!assignLiverId || assignMutation.isPending}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
            >
              <Send className="h-4 w-4 mr-1" />
              {assignMutation.isPending ? "送信中..." : "アサイン＆LINE通知"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 横推一键通知ダイアログ */}
      <Dialog open={showBroadcastDialog} onOpenChange={setShowBroadcastDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-purple-500" /> 横推一键通知
            </DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <div className="font-bold text-lg">{selectedProduct.name}</div>
                <div className="text-sm mt-1 space-y-1">
                  <div>💰 売値: ¥{selectedProduct.sellPrice}</div>
                  <div>📊 スコア: {selectedProduct.score}</div>
                  <div>📈 転換率: {selectedProduct.conversionRate}%</div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <div className="flex items-center gap-2 text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  <AlertTriangle className="h-4 w-4" />
                  全アクティブ主播（LINE連携済み）に一斉送信されます
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">追加メッセージ（任意）</label>
                <Textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="全主播への追加メッセージ..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">キャンセル</Button>
            </DialogClose>
            <Button
              onClick={() => {
                if (selectedProduct) {
                  broadcastMutation.mutate({
                    productId: selectedProduct.id,
                    customMessage: broadcastMessage || undefined,
                  });
                }
              }}
              disabled={broadcastMutation.isPending}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white"
            >
              <Megaphone className="h-4 w-4 mr-1" />
              {broadcastMutation.isPending ? "送信中..." : "🔥 全主播に一斉通知"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 商品カードコンポーネント
function ProductCard({ product, onStatusChange, onAssign, onBroadcast, onDelete }: {
  product: any;
  onStatusChange: (status: string) => void;
  onAssign: () => void;
  onBroadcast: () => void;
  onDelete: () => void;
}) {
  const config = STATUS_CONFIG[product.status] || STATUS_CONFIG.candidate;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* 商品画像 */}
          {product.imageUrl && (
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
            </div>
          )}
          
          {/* 商品情報 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium truncate">{product.name}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge className={`${config.color} text-white text-xs`}>
                    {config.emoji} {config.label}
                  </Badge>
                  {product.category && (
                    <Badge variant="outline" className="text-xs">{product.category}</Badge>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-medium">¥{Number(product.sellPrice).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">原価 ¥{Number(product.costPrice).toLocaleString()}</div>
                {product.profitMargin && (
                  <div className="text-xs text-green-600 dark:text-green-400">利益率 {Number(product.profitMargin).toFixed(0)}%</div>
                )}
              </div>
            </div>

            {/* メトリクス */}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" /> スコア: {product.score || 0}
              </span>
              <span className="flex items-center gap-1">
                <ShoppingCart className="h-3 w-3" /> 販売: {product.totalSales || 0}
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> 転換率: {product.conversionRate || 0}%
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> GMV: ¥{Number(product.totalGmv || 0).toLocaleString()}
              </span>
            </div>

            {/* アクションボタン */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {product.status === "candidate" && (
                <Button size="sm" variant="outline" onClick={() => onAssign()}>
                  <Send className="h-3 w-3 mr-1" /> テスト配信
                </Button>
              )}
              {product.status === "testing" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => onAssign()}>
                    <Send className="h-3 w-3 mr-1" /> 追加テスト
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onStatusChange("hit")} className="text-orange-600 border-orange-300">
                    🔥 爆品認定
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onStatusChange("eliminated")} className="text-red-600 border-red-300">
                    ❌ 淘汰
                  </Button>
                </>
              )}
              {product.status === "hit" && (
                <Button size="sm" className="bg-gradient-to-r from-purple-500 to-pink-500 text-white" onClick={() => onBroadcast()}>
                  <Megaphone className="h-3 w-3 mr-1" /> 横推開始
                </Button>
              )}
              {product.status === "spreading" && (
                <Button size="sm" variant="outline" onClick={() => onStatusChange("standard")} className="text-green-600 border-green-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> 定番化
                </Button>
              )}
              {/* ステータス変更ドロップダウン */}
              <Select onValueChange={(v) => onStatusChange(v)}>
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue placeholder="ステータス変更" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key} disabled={key === product.status}>
                      {cfg.emoji} {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 ml-auto" onClick={onDelete}>
                削除
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
