import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Star,
  Plus,
  Trash2,
  Edit,
  ArrowLeft,
  Trophy,
  Clock,
  AlertTriangle,
  ExternalLink,
  Package,
} from "lucide-react";
import { useLocation } from "wouter";

type FeaturedProduct = {
  id: number;
  productName: string;
  tiktokShopUrl?: string | null;
  productImageUrl?: string | null;
  brandName?: string | null;
  quotaDurationMinutes: number;
  startDate: string;
  endDate: string;
  notes?: string | null;
  setProposal?: string | null;
  talkScript?: string | null;
  successCase?: string | null;
  targetType: "all" | "specific";
  isActive: boolean;
  priority: number;
};

export default function FeaturedProductsAdmin() {
  const [, navigate] = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<FeaturedProduct | null>(null);
  const [form, setForm] = useState({
    productName: "",
    tiktokShopUrl: "",
    productImageUrl: "",
    brandName: "",
    quotaDurationMinutes: 60,
    startDate: "",
    endDate: "",
    notes: "",
    setProposal: "",
    talkScript: "",
    successCase: "",
    targetType: "all" as "all" | "specific",
    priority: 0,
  });

  // Fetch data
  const productsQuery = trpc.featuredProduct.getAll.useQuery();
  const rankingsQuery = trpc.featuredProduct.getRankings.useQuery();

  // Mutations
  const createMut = trpc.featuredProduct.create.useMutation({
    onSuccess: () => {
      toast.success("重点商品を登録しました");
      productsQuery.refetch();
      resetForm();
    },
    onError: (err) => toast.error(`エラー: ${err.message}`),
  });

  const updateMut = trpc.featuredProduct.update.useMutation({
    onSuccess: () => {
      toast.success("重点商品を更新しました");
      productsQuery.refetch();
      resetForm();
    },
    onError: (err) => toast.error(`エラー: ${err.message}`),
  });

  const deleteMut = trpc.featuredProduct.delete.useMutation({
    onSuccess: () => {
      toast.success("重点商品を削除しました");
      productsQuery.refetch();
    },
    onError: (err) => toast.error(`エラー: ${err.message}`),
  });

  const processExpiredMut = trpc.featuredProduct.processExpired.useMutation({
    onSuccess: (data) => {
      toast.success(`期限切れ処理完了: ${data.processed}件のペナルティを記録`);
      productsQuery.refetch();
      rankingsQuery.refetch();
    },
    onError: (err) => toast.error(`エラー: ${err.message}`),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    setForm({
      productName: "",
      tiktokShopUrl: "",
      productImageUrl: "",
      brandName: "",
      quotaDurationMinutes: 60,
      startDate: "",
      endDate: "",
      notes: "",
      setProposal: "",
      talkScript: "",
      successCase: "",
      targetType: "all",
      priority: 0,
    });
  };

  const handleEdit = (product: FeaturedProduct) => {
    setEditingProduct(product);
    setForm({
      productName: product.productName,
      tiktokShopUrl: product.tiktokShopUrl || "",
      productImageUrl: product.productImageUrl || "",
      brandName: product.brandName || "",
      quotaDurationMinutes: product.quotaDurationMinutes,
      startDate: product.startDate,
      endDate: product.endDate,
      notes: product.notes || "",
      setProposal: product.setProposal || "",
      talkScript: product.talkScript || "",
      successCase: product.successCase || "",
      targetType: product.targetType,
      priority: product.priority,
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.productName || !form.startDate || !form.endDate) {
      toast.error("商品名、開始日、終了日は必須です");
      return;
    }
    if (editingProduct) {
      updateMut.mutate({ id: editingProduct.id, ...form });
    } else {
      createMut.mutate(form);
    }
  };

  const isExpired = (endDate: string) => {
    return new Date(endDate) < new Date(new Date().toISOString().split('T')[0]);
  };

  const isActive = (startDate: string, endDate: string) => {
    const today = new Date().toISOString().split('T')[0];
    return startDate <= today && endDate >= today;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/master/livers-dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Star className="h-6 w-6 text-yellow-400" />
            今週の重点商品管理
          </h1>
          <p className="text-gray-400 text-sm">ライバーへの推し商品・ノルマ設定</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => processExpiredMut.mutate()}
            disabled={processExpiredMut.isPending}
          >
            <AlertTriangle className="h-4 w-4 mr-1" />
            期限切れ処理
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            新規登録
          </Button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="bg-gray-900 border-gray-800 mb-6">
          <CardHeader>
            <CardTitle className="text-lg">
              {editingProduct ? "重点商品を編集" : "新しい重点商品を登録"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">商品名 *</label>
                <Input
                  className="bg-gray-800 border-gray-700"
                  value={form.productName}
                  onChange={(e) => setForm({ ...form, productName: e.target.value })}
                  placeholder="KYOGOKU新シャンプー"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">ブランド名</label>
                <Input
                  className="bg-gray-800 border-gray-700"
                  value={form.brandName}
                  onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                  placeholder="KYOGOKU"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">TikTok Shopリンク</label>
                <Input
                  className="bg-gray-800 border-gray-700"
                  value={form.tiktokShopUrl}
                  onChange={(e) => setForm({ ...form, tiktokShopUrl: e.target.value })}
                  placeholder="https://www.tiktok.com/..."
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">商品画像URL</label>
                <Input
                  className="bg-gray-800 border-gray-700"
                  value={form.productImageUrl}
                  onChange={(e) => setForm({ ...form, productImageUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">ノルマ配信時間（分）*</label>
                <Input
                  className="bg-gray-800 border-gray-700"
                  type="number"
                  value={form.quotaDurationMinutes}
                  onChange={(e) => setForm({ ...form, quotaDurationMinutes: parseInt(e.target.value) || 60 })}
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">優先度</label>
                <Input
                  className="bg-gray-800 border-gray-700"
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">開始日 *</label>
                <Input
                  className="bg-gray-800 border-gray-700"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">終了日 *</label>
                <Input
                  className="bg-gray-800 border-gray-700"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">備考（セット組OK、割引○%OK等）</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-white text-sm"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="セット組OK / 割引15%OK / 単品販売のみ"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">セット提案</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-white text-sm"
                rows={2}
                value={form.setProposal}
                onChange={(e) => setForm({ ...form, setProposal: e.target.value })}
                placeholder="この商品 + トリートメントのセットで売ると単価UP"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">トークスクリプト</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-white text-sm"
                rows={3}
                value={form.talkScript}
                onChange={(e) => setForm({ ...form, talkScript: e.target.value })}
                placeholder="「この商品は○○で、実際に使ってみたら△△が良かったです...」"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">成功事例</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-white text-sm"
                rows={2}
                value={form.successCase}
                onChange={(e) => setForm({ ...form, successCase: e.target.value })}
                placeholder="○○さんがこの方法で1配信5万円売った"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
                {editingProduct ? "更新" : "登録"}
              </Button>
              <Button variant="ghost" onClick={resetForm}>
                キャンセル
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product List */}
      <div className="grid grid-cols-1 gap-4 mb-8">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5" />
          登録済み重点商品
        </h2>
        {productsQuery.data?.length === 0 && (
          <p className="text-gray-500 text-sm">まだ重点商品が登録されていません</p>
        )}
        {productsQuery.data?.map((product: any) => (
          <Card key={product.id} className={`bg-gray-900 border-gray-800 ${isExpired(product.endDate) ? 'opacity-60' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white">{product.productName}</h3>
                    {product.brandName && (
                      <Badge variant="outline" className="text-xs">{product.brandName}</Badge>
                    )}
                    {isActive(product.startDate, product.endDate) ? (
                      <Badge className="bg-green-600 text-xs">有効</Badge>
                    ) : isExpired(product.endDate) ? (
                      <Badge className="bg-red-600 text-xs">期限切れ</Badge>
                    ) : (
                      <Badge className="bg-blue-600 text-xs">予定</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-2">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      ノルマ: {product.quotaDurationMinutes}分
                    </span>
                    <span>期間: {product.startDate} ~ {product.endDate}</span>
                    <span>対象: {product.targetType === 'all' ? '全員' : '特定'}</span>
                  </div>
                  {product.notes && (
                    <p className="text-sm text-yellow-400 mb-1">📋 {product.notes}</p>
                  )}
                  {product.tiktokShopUrl && (
                    <a
                      href={product.tiktokShopUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      TikTok Shop
                    </a>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm("この重点商品を削除しますか？")) {
                        deleteMut.mutate({ id: product.id });
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rankings */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-400" />
            ノルマ達成率ランキング
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rankingsQuery.data?.length === 0 && (
            <p className="text-gray-500 text-sm">まだデータがありません</p>
          )}
          <div className="space-y-2">
            {rankingsQuery.data?.map((item: any, idx: number) => (
              <div key={item.liverId} className="flex items-center gap-3 p-2 rounded bg-gray-800">
                <span className={`text-lg font-bold w-8 text-center ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-orange-400' : 'text-gray-500'}`}>
                  {idx + 1}
                </span>
                {item.avatarUrl ? (
                  <img src={item.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs">
                    {item.liverName?.charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <span className="text-sm font-medium">{item.liverName}</span>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold ${item.achievementRate >= 100 ? 'text-green-400' : item.achievementRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {item.achievementRate}%
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    {item.achievedMinutes}/{item.totalQuotaMinutes}分
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
