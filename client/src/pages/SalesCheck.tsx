import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ClipboardCheck,
  Edit3,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Clock,
  Users,
  ShoppingCart,
  Image as ImageIcon,
  Eye,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

// 金額フォーマット
const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return "—";
  return `¥${amount.toLocaleString()}`;
};

// 配信時間フォーマット（分→時間:分）
const formatDuration = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}時間${m}分` : `${m}分`;
};

// 日付フォーマット（UTC→JST）
const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return "—";
  const d = new Date(date);
  // UTC→JST変換
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getMonth() + 1}/${jst.getDate()} ${String(jst.getHours()).padStart(2, "0")}:${String(jst.getMinutes()).padStart(2, "0")}`;
};

// 月選択肢を生成（過去12ヶ月）
const getMonthOptions = () => {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  // JST基準
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  for (let i = 0; i < 12; i++) {
    const d = new Date(jstNow.getFullYear(), jstNow.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    options.push({ value, label });
  }
  return options;
};

export default function SalesCheck() {
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [selectedLiverId, setSelectedLiverId] = useState<string>("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<{
    salesAmount: string;
    duration: string;
    viewerCount: string;
    orderCount: string;
    remarks: string;
  }>({ salesAmount: "", duration: "", viewerCount: "", orderCount: "", remarks: "" });
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // ライバー一覧取得
  const { data: livers } = trpc.liverManagement.listAll.useQuery();

  // 配信記録一覧取得
  const { data: livestreams, isLoading, refetch } = trpc.salesCheck.list.useQuery({
    month: selectedMonth,
    liverId: selectedLiverId !== "all" ? Number(selectedLiverId) : undefined,
  });

  // 訂正mutation
  const correctMutation = trpc.salesCheck.correct.useMutation({
    onSuccess: () => {
      toast.success("訂正を保存しました");
      setEditingId(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`保存に失敗しました: ${error.message}`);
    },
  });

  // 編集開始
  const startEdit = (item: NonNullable<typeof livestreams>[number]) => {
    setEditingId(item.id);
    setEditData({
      salesAmount: item.salesAmount?.toString() || "",
      duration: item.duration?.toString() || "",
      viewerCount: item.viewerCount?.toString() || "",
      orderCount: item.orderCount?.toString() || "",
      remarks: item.remarks || "",
    });
  };

  // 訂正保存
  const saveCorrection = () => {
    if (editingId === null) return;
    correctMutation.mutate({
      id: editingId,
      salesAmount: editData.salesAmount ? Number(editData.salesAmount) : null,
      duration: editData.duration ? Number(editData.duration) : null,
      viewerCount: editData.viewerCount ? Number(editData.viewerCount) : null,
      orderCount: editData.orderCount ? Number(editData.orderCount) : null,
      remarks: editData.remarks || null,
    });
  };

  // 集計
  const summary = useMemo(() => {
    if (!livestreams || livestreams.length === 0) return null;
    const totalSales = livestreams.reduce((sum, l) => sum + (l.salesAmount || 0), 0);
    const totalDuration = livestreams.reduce((sum, l) => sum + (l.duration || 0), 0);
    const totalOrders = livestreams.reduce((sum, l) => sum + (l.orderCount || 0), 0);
    const count = livestreams.length;
    return { totalSales, totalDuration, totalOrders, count };
  }, [livestreams]);

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">売上チェック＆訂正</h1>
          <p className="text-sm text-muted-foreground">
            ライバーの配信記録（売上・配信時間）を確認し、間違いがあれば訂正できます
          </p>
        </div>
      </div>

      {/* フィルター */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>月</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ライバー</Label>
              <Select value={selectedLiverId} onValueChange={setSelectedLiverId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全員</SelectItem>
                  {livers?.map((liver) => (
                    <SelectItem key={liver.id} value={liver.id.toString()}>
                      {liver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* サマリーカード */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <DollarSign className="h-4 w-4" />
                合計売上
              </div>
              <div className="text-xl font-bold">{formatCurrency(summary.totalSales)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Clock className="h-4 w-4" />
                合計配信時間
              </div>
              <div className="text-xl font-bold">{formatDuration(summary.totalDuration)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <ShoppingCart className="h-4 w-4" />
                合計注文数
              </div>
              <div className="text-xl font-bold">{summary.totalOrders.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <CheckCircle2 className="h-4 w-4" />
                配信回数
              </div>
              <div className="text-xl font-bold">{summary.count}回</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 配信記録一覧 */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !livestreams || livestreams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>該当する配信記録がありません</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {livestreams.map((item) => (
            <Card key={item.id} className={editingId === item.id ? "ring-2 ring-primary" : ""}>
              <CardContent className="py-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* 左: ライバー情報＆日時 */}
                  <div className="flex items-center gap-3 lg:w-[200px] shrink-0">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={item.liverAvatar || undefined} />
                      <AvatarFallback
                        style={{ backgroundColor: item.liverColor || "#FF69B4" }}
                        className="text-white text-sm font-bold"
                      >
                        {(item.liverName || item.streamerName || "?")[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold text-sm">
                        {item.liverName || item.streamerName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(item.livestreamDate)}
                      </div>
                      {item.brandName && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {item.brandName}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* 中: データ表示 or 編集フォーム */}
                  {editingId === item.id ? (
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">売上金額（円）</Label>
                        <Input
                          type="number"
                          value={editData.salesAmount}
                          onChange={(e) =>
                            setEditData({ ...editData, salesAmount: e.target.value })
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">配信時間（分）</Label>
                        <Input
                          type="number"
                          value={editData.duration}
                          onChange={(e) =>
                            setEditData({ ...editData, duration: e.target.value })
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">視聴者数</Label>
                        <Input
                          type="number"
                          value={editData.viewerCount}
                          onChange={(e) =>
                            setEditData({ ...editData, viewerCount: e.target.value })
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">注文数</Label>
                        <Input
                          type="number"
                          value={editData.orderCount}
                          onChange={(e) =>
                            setEditData({ ...editData, orderCount: e.target.value })
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="col-span-2 md:col-span-4 space-y-1">
                        <Label className="text-xs">備考</Label>
                        <Input
                          value={editData.remarks}
                          onChange={(e) =>
                            setEditData({ ...editData, remarks: e.target.value })
                          }
                          placeholder="訂正理由など"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          売上
                        </div>
                        <div className="font-semibold">
                          {formatCurrency(item.salesAmount)}
                        </div>
                        {item.manualSalesAmount !== null && item.manualSalesAmount !== undefined && item.manualSalesAmount !== item.salesAmount && (
                          <div className="text-xs text-amber-500">
                            手入力: {formatCurrency(item.manualSalesAmount)}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          配信時間
                        </div>
                        <div className="font-semibold">
                          {formatDuration(item.duration)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          視聴者
                        </div>
                        <div className="font-semibold">
                          {item.viewerCount?.toLocaleString() || "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <ShoppingCart className="h-3 w-3" />
                          注文数
                        </div>
                        <div className="font-semibold">
                          {item.orderCount?.toLocaleString() || "—"}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 右: スクショ＆アクション */}
                  <div className="flex items-center gap-2 lg:w-[160px] shrink-0 justify-end">
                    {/* スクリーンショットサムネイル */}
                    {item.screenshotUrl && (
                      <button
                        onClick={() => setPreviewImage(item.screenshotUrl)}
                        className="relative h-14 w-14 rounded-md overflow-hidden border hover:ring-2 hover:ring-primary transition-all shrink-0"
                      >
                        <img
                          src={item.screenshotUrl}
                          alt="配信スクショ"
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <Eye className="h-4 w-4 text-white" />
                        </div>
                      </button>
                    )}

                    {editingId === item.id ? (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={saveCorrection}
                          disabled={correctMutation.isPending}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          保存
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(item)}
                      >
                        <Edit3 className="h-4 w-4 mr-1" />
                        訂正
                      </Button>
                    )}
                  </div>
                </div>

                {/* 備考表示 */}
                {!editingId && item.remarks && (
                  <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded px-3 py-1.5">
                    📝 {item.remarks}
                  </div>
                )}

                {/* 配信結果バッジ */}
                {item.result && (
                  <div className="mt-2">
                    <Badge
                      variant={item.result === "成功" ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {item.result}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 画像プレビューダイアログ */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>配信スクリーンショット</DialogTitle>
            <DialogDescription>
              登録されたデータとスクリーンショットを照らし合わせて確認してください
            </DialogDescription>
          </DialogHeader>
          {previewImage && (
            <div className="flex justify-center">
              <img
                src={previewImage}
                alt="配信スクリーンショット"
                className="max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
