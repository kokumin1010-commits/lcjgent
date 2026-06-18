import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Plus, Search, TrendingUp, Calendar, DollarSign, BarChart3, Edit, Trash2, Eye, CheckCircle, ShoppingBag, Check, X, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

// ==================== Products Tab ====================
function ProductsTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);

  const productsQuery = trpc.selectionCenter.getProducts.useQuery({
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter as any,
    page: 1,
    pageSize: 50,
  });

  const categoriesQuery = trpc.selectionCenter.getCategories.useQuery();
  const createMutation = trpc.selectionCenter.createProduct.useMutation({
    onSuccess: () => { productsQuery.refetch(); setShowCreateDialog(false); toast.success("商品を追加しました"); },
  });
  const updateMutation = trpc.selectionCenter.updateProduct.useMutation({
    onSuccess: () => { productsQuery.refetch(); setEditProduct(null); toast.success("商品を更新しました"); },
  });
  const statusMutation = trpc.selectionCenter.updateProductStatus.useMutation({
    onSuccess: () => { productsQuery.refetch(); toast.success("ステータスを更新しました"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="商品名・ブランド名・バーコードで検索..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全て</SelectItem>
            <SelectItem value="draft">下書き</SelectItem>
            <SelectItem value="online">公開中</SelectItem>
            <SelectItem value="offline">非公開</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowCreateDialog(true)}><Plus className="h-4 w-4 mr-1" />商品追加</Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium w-12">画像</th>
              <th className="text-left p-3 font-medium">商品名</th>
              <th className="text-left p-3 font-medium">バーコード</th>
              <th className="text-left p-3 font-medium">ブランド</th>
              <th className="text-left p-3 font-medium">カテゴリ</th>
              <th className="text-right p-3 font-medium">価格</th>
              <th className="text-right p-3 font-medium">佣金</th>
              <th className="text-center p-3 font-medium">在庫</th>
              <th className="text-center p-3 font-medium">ステータス</th>
              <th className="text-center p-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {productsQuery.data?.items?.map((product: any) => {
              const category = categoriesQuery.data?.find((c: any) => c.id === product.categoryId);
              return (
                <tr key={product.id} className="border-t hover:bg-muted/30">
                  <td className="p-3">
                    {(() => {
                      const imgs = product.images ? (typeof product.images === 'string' ? JSON.parse(product.images) : product.images) : [];
                      return imgs.length > 0 ? (
                        <img src={imgs[0]} alt="" className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <Package className="w-4 h-4 text-muted-foreground" />
                        </div>
                      );
                    })()}
                  </td>
                  <td className="p-3 font-medium max-w-[200px] truncate">{product.productName}</td>
                  <td className="p-3 text-muted-foreground text-xs font-mono">{product.barcode || "-"}</td>
                  <td className="p-3 text-muted-foreground">{product.brandName}</td>
                  <td className="p-3">{category ? (categoriesQuery.data?.find((p: any) => p.id === category.parentId)?.name ? categoriesQuery.data.find((p: any) => p.id === category.parentId).name + " / " + category.name : category.name) : "-"}</td>
                  <td className="p-3 text-right">¥{Number(product.price || 0).toLocaleString()}</td>
                  <td className="p-3 text-right">
                    {product.commissionType === "percentage" ? `${product.commissionValue}%` : `¥${product.commissionValue}`}
                  </td>
                  <td className="p-3 text-center">{product.stock ?? "-"}</td>
                  <td className="p-3 text-center">
                    <Badge variant={product.status === "online" ? "default" : product.status === "draft" ? "secondary" : "outline"}>
                      {product.status === "online" ? "公開中" : product.status === "draft" ? "下書き" : "非公開"}
                    </Badge>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditProduct(product)}><Edit className="h-3.5 w-3.5" /></Button>
                      {product.status !== "online" && (
                        <Button variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: product.id, status: "online" })}>
                          <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                        </Button>
                      )}
                      {product.status === "online" && (
                        <Button variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: product.id, status: "offline" })}>
                          <Eye className="h-3.5 w-3.5 text-orange-600" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {(!productsQuery.data?.items || productsQuery.data.items.length === 0) && (
              <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">商品がありません</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">全{productsQuery.data?.total || 0}件</p>

      {/* Create/Edit Dialog */}
      <ProductFormDialog
        open={showCreateDialog || !!editProduct}
        onClose={() => { setShowCreateDialog(false); setEditProduct(null); }}
        product={editProduct}
        categories={categoriesQuery.data || []}
        onSubmit={(data) => {
          if (editProduct) {
            updateMutation.mutate({ id: editProduct.id, ...data });
          } else {
            createMutation.mutate(data);
          }
        }}
        loading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}

function ProductFormDialog({ open, onClose, product, categories, onSubmit, loading }: any) {
  const [form, setForm] = useState<any>(product || {});
  const [uploading, setUploading] = useState(false);
  const isEdit = !!product;

  useState(() => { if (product) setForm(product); });

  const uploadMutation = trpc.selectionCenter.uploadProductImage.useMutation();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const currentImages: string[] = form.images ? (typeof form.images === 'string' ? JSON.parse(form.images) : form.images) : [];
      for (const file of files) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const result = await uploadMutation.mutateAsync({
          fileName: file.name,
          mimeType: file.type,
          base64Data: base64,
        });
        currentImages.push(result.url);
      }
      setForm({ ...form, images: currentImages });
      toast.success(`${files.length}枚の画像をアップロードしました`);
    } catch (err: any) {
      toast.error(err?.message || "画像のアップロードに失敗しました");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeImage = (index: number) => {
    const currentImages: string[] = form.images ? (typeof form.images === 'string' ? JSON.parse(form.images) : form.images) : [];
    currentImages.splice(index, 1);
    setForm({ ...form, images: [...currentImages] });
  };

  const imageList: string[] = form.images ? (typeof form.images === 'string' ? JSON.parse(form.images) : form.images) : [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "商品編集" : "商品追加"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          {/* Image Upload Section */}
          <div className="col-span-2">
            <Label>商品画像</Label>
            <div className="mt-2 flex flex-wrap gap-3">
              {imageList.map((url: string, idx: number) => (
                <div key={idx} className="relative group w-20 h-20 rounded-lg border overflow-hidden">
                  <img src={url} alt={`商品画像 ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <label className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <ImagePlus className="w-5 h-5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground mt-1">追加</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          <div className="col-span-2">
            <Label>商品名 *</Label>
            <Input value={form.productName || ""} onChange={e => setForm({ ...form, productName: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>商品バーコード</Label>
            <Input value={form.barcode || ""} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder="JANコード / EANコード" />
          </div>
          <div>
            <Label>ブランド名 *</Label>
            <Input value={form.brandName || ""} onChange={e => setForm({ ...form, brandName: e.target.value })} />
          </div>
          <div>
            <Label>カテゴリ</Label>
            <Select value={String(form.categoryId || "")} onValueChange={v => setForm({ ...form, categoryId: Number(v) })}>
              <SelectTrigger><SelectValue placeholder="選択..." /></SelectTrigger>
              <SelectContent>
                {categories.map((c: any) => { const parent = c.parentId ? categories.find((p: any) => p.id === c.parentId) : null; return <SelectItem key={c.id} value={String(c.id)}>{parent ? parent.name + " / " : ""}{c.name}</SelectItem>; })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>販売価格</Label>
            <Input type="number" value={form.price || ""} onChange={e => setForm({ ...form, price: e.target.value })} />
          </div>
          <div>
            <Label>市場価格</Label>
            <Input type="number" value={form.marketPrice || ""} onChange={e => setForm({ ...form, marketPrice: e.target.value })} />
          </div>
          <div>
            <Label>佣金タイプ</Label>
            <Select value={form.commissionType || "percentage"} onValueChange={v => setForm({ ...form, commissionType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">パーセント (%)</SelectItem>
                <SelectItem value="fixed">固定額 (¥)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>佣金値</Label>
            <Input type="number" value={form.commissionValue || ""} onChange={e => setForm({ ...form, commissionValue: e.target.value })} />
          </div>
          <div>
            <Label>在庫数</Label>
            <Input type="number" value={form.stock || ""} onChange={e => setForm({ ...form, stock: Number(e.target.value) })} />
          </div>
          <div>
            <Label>商品リンク</Label>
            <Input value={form.productLink || ""} onChange={e => setForm({ ...form, productLink: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>セールスポイント</Label>
            <Textarea value={form.sellingPoints || ""} onChange={e => setForm({ ...form, sellingPoints: e.target.value })} rows={3} />
          </div>
          <div className="col-span-2">
            <Label>サプライヤー連絡先</Label>
            <Input value={form.supplierContact || ""} onChange={e => setForm({ ...form, supplierContact: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={() => onSubmit(form)} disabled={loading || uploading || !form.productName || !form.brandName}>
            {loading ? "保存中..." : isEdit ? "更新" : "追加"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== 主播選品 Tab ====================
function LiverSelectionTab() {
  const [search, setSearch] = useState("");
  const [selectedLiverId, setSelectedLiverId] = useState<string>("");

  const productsQuery = trpc.selectionCenter.getLiverAvailableProducts.useQuery({
    search: search || undefined,
  });
  const liversQuery = trpc.selectionCenter.getLivers.useQuery();
  const selectionsQuery = trpc.selectionCenter.getSelections.useQuery();

  const selectMutation = trpc.selectionCenter.liverSelectProduct.useMutation({
    onSuccess: () => {
      selectionsQuery.refetch();
      toast.success("選品しました！");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = trpc.selectionCenter.deleteSelection.useMutation({
    onSuccess: () => {
      selectionsQuery.refetch();
      toast.success("選品を取消しました");
    },
  });

  // Get product IDs already selected by the current liver
  const selectedProductIds = useMemo(() => {
    if (!selectedLiverId || !selectionsQuery.data) return new Set<number>();
    return new Set(
      selectionsQuery.data
        .filter((s: any) => s.liverId === Number(selectedLiverId))
        .map((s: any) => s.productId)
    );
  }, [selectedLiverId, selectionsQuery.data]);

  return (
    <div className="space-y-6">
      {/* Liver selector and search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap font-medium">主播:</Label>
          <Select value={selectedLiverId} onValueChange={setSelectedLiverId}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="主播を選択..." /></SelectTrigger>
            <SelectContent>
              {(liversQuery.data || []).map((liver: any) => (
                <SelectItem key={liver.id} value={String(liver.id)}>{liver.name}</SelectItem>
              ))}
              {(!liversQuery.data || liversQuery.data.length === 0) && (
                <SelectItem value="__none" disabled>主播がいません</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="商品名・ブランド名で検索..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Available products grid */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-3">公開中の商品（{productsQuery.data?.length || 0}件）</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {productsQuery.data?.map((product: any) => (
            <Card key={product.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{product.productName}</h3>
                    <p className="text-sm text-muted-foreground">{product.brandName}</p>
                    <div className="flex items-center gap-3 mt-2 text-sm">
                      <span className="font-medium text-orange-600">¥{Number(product.price || 0).toLocaleString()}</span>
                      <Badge variant="outline" className="text-xs">
                        佣金: {product.commissionType === "percentage" ? `${product.commissionValue}%` : `¥${product.commissionValue}`}
                      </Badge>
                    </div>
                    {product.sellingPoints && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{product.sellingPoints}</p>
                    )}
                  </div>
                  <div>
                    {!selectedLiverId ? (
                      <Button size="sm" variant="outline" disabled className="text-xs">主播を選択</Button>
                    ) : selectedProductIds.has(product.id) ? (
                      <Button size="sm" variant="secondary" disabled><Check className="h-4 w-4 mr-1" />選品済</Button>
                    ) : (
                      <Button size="sm" onClick={() => selectMutation.mutate({ productId: product.id, liverId: Number(selectedLiverId) })} disabled={selectMutation.isPending}>
                        選品する
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!productsQuery.data || productsQuery.data.length === 0) && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              公開中の商品がありません。「商品管理」タブで商品を公開してください。
            </div>
          )}
        </div>
      </div>

      {/* Current selections list */}
      {selectionsQuery.data && selectionsQuery.data.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">選品一覧（{selectionsQuery.data.length}件）</h4>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">主播</th>
                  <th className="text-left p-3 font-medium">商品名</th>
                  <th className="text-left p-3 font-medium">ブランド</th>
                  <th className="text-center p-3 font-medium">佣金</th>
                  <th className="text-center p-3 font-medium">ステータス</th>
                  <th className="text-center p-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {selectionsQuery.data.map((s: any) => (
                  <tr key={s.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-medium">{s.liverName}</td>
                    <td className="p-3">{s.productName || "-"}</td>
                    <td className="p-3 text-muted-foreground">{s.brandName || "-"}</td>
                    <td className="p-3 text-center">
                      {s.commissionType === "percentage" ? `${s.commissionValue}%` : `¥${s.commissionValue}`}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={s.status === "approved" ? "default" : s.status === "rejected" ? "destructive" : "secondary"}>
                        {s.status === "approved" ? "承認済" : s.status === "rejected" ? "却下" : "保留中"}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate({ id: s.id })}>
                        <X className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Schedules Tab ====================
function SchedulesTab() {
  const schedulesQuery = trpc.selectionCenter.getSchedules.useQuery();
  const updateMutation = trpc.selectionCenter.updateSchedule.useMutation({
    onSuccess: () => { schedulesQuery.refetch(); toast.success("排期を更新しました"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">排期管理</h3>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">配信日</th>
              <th className="text-left p-3 font-medium">主播ID</th>
              <th className="text-left p-3 font-medium">商品</th>
              <th className="text-center p-3 font-medium">時間帯</th>
              <th className="text-center p-3 font-medium">順番</th>
              <th className="text-center p-3 font-medium">ステータス</th>
              <th className="text-center p-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {schedulesQuery.data?.map((schedule: any) => (
              <tr key={schedule.id} className="border-t hover:bg-muted/30">
                <td className="p-3">{schedule.liveDate}</td>
                <td className="p-3">{schedule.anchorId}</td>
                <td className="p-3">{schedule.product?.productName || "-"}</td>
                <td className="p-3 text-center">{schedule.startTime || "-"} ~ {schedule.endTime || "-"}</td>
                <td className="p-3 text-center">{schedule.slotOrder || "-"}</td>
                <td className="p-3 text-center">
                  <Badge variant={schedule.status === "confirmed" ? "default" : schedule.status === "done" ? "secondary" : "outline"}>
                    {schedule.status === "pending" ? "未確認" : schedule.status === "confirmed" ? "確認済" : schedule.status === "done" ? "完了" : "キャンセル"}
                  </Badge>
                </td>
                <td className="p-3 text-center">
                  {schedule.status === "pending" && (
                    <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ id: schedule.id, status: "confirmed" })}>
                      <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                    </Button>
                  )}
                  {schedule.status === "confirmed" && (
                    <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ id: schedule.id, status: "done" })}>
                      完了
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {(!schedulesQuery.data || schedulesQuery.data.length === 0) && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">排期データがありません</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== Performances Tab ====================
function PerformancesTab() {
  const performancesQuery = trpc.selectionCenter.getPerformances.useQuery();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">帯貨データ</h3>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">配信日</th>
              <th className="text-left p-3 font-medium">主播ID</th>
              <th className="text-left p-3 font-medium">商品</th>
              <th className="text-right p-3 font-medium">GMV</th>
              <th className="text-right p-3 font-medium">販売数</th>
              <th className="text-right p-3 font-medium">佣金</th>
              <th className="text-center p-3 font-medium">ステータス</th>
            </tr>
          </thead>
          <tbody>
            {performancesQuery.data?.map((perf: any) => (
              <tr key={perf.id} className="border-t hover:bg-muted/30">
                <td className="p-3">{perf.liveDate}</td>
                <td className="p-3">{perf.liverId}</td>
                <td className="p-3">{perf.product?.productName || "-"}</td>
                <td className="p-3 text-right">¥{Number(perf.gmv || 0).toLocaleString()}</td>
                <td className="p-3 text-right">{perf.salesCount || 0}</td>
                <td className="p-3 text-right">¥{Number(perf.commissionAmount || 0).toLocaleString()}</td>
                <td className="p-3 text-center">
                  <Badge variant={perf.status === "confirmed" ? "default" : "secondary"}>
                    {perf.status === "confirmed" ? "確定" : "下書き"}
                  </Badge>
                </td>
              </tr>
            ))}
            {(!performancesQuery.data || performancesQuery.data.length === 0) && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">帯貨データがありません</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== Settlements Tab ====================
function SettlementsTab() {
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({ anchorId: "", periodStart: "", periodEnd: "" });

  const settlementsQuery = trpc.selectionCenter.getSettlements.useQuery();
  const generateMutation = trpc.selectionCenter.generateSettlement.useMutation({
    onSuccess: (data) => {
      settlementsQuery.refetch();
      setShowGenerate(false);
      toast.success(`結算書を生成しました（GMV: ¥${Number(data.totalGmv).toLocaleString()}, 佣金: ¥${Number(data.totalCommission).toLocaleString()}）`);
    },
  });
  const statusMutation = trpc.selectionCenter.updateSettlementStatus.useMutation({
    onSuccess: () => { settlementsQuery.refetch(); toast.success("ステータスを更新しました"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">結算管理</h3>
        <Button onClick={() => setShowGenerate(true)}><Plus className="h-4 w-4 mr-1" />結算書生成</Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">主播ID</th>
              <th className="text-left p-3 font-medium">期間</th>
              <th className="text-right p-3 font-medium">GMV合計</th>
              <th className="text-right p-3 font-medium">佣金合計</th>
              <th className="text-center p-3 font-medium">ステータス</th>
              <th className="text-center p-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {settlementsQuery.data?.map((s: any) => (
              <tr key={s.id} className="border-t hover:bg-muted/30">
                <td className="p-3">{s.liverId}</td>
                <td className="p-3">{s.periodStart} ~ {s.periodEnd}</td>
                <td className="p-3 text-right">¥{Number(s.totalGmv || 0).toLocaleString()}</td>
                <td className="p-3 text-right">¥{Number(s.totalCommission || 0).toLocaleString()}</td>
                <td className="p-3 text-center">
                  <Badge variant={s.status === "paid" ? "default" : s.status === "confirmed" ? "secondary" : "outline"}>
                    {s.status === "pending" ? "未確認" : s.status === "confirmed" ? "確認済" : "支払済"}
                  </Badge>
                </td>
                <td className="p-3 text-center">
                  {s.status === "pending" && (
                    <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate({ id: s.id, status: "confirmed" })}>確認</Button>
                  )}
                  {s.status === "confirmed" && (
                    <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate({ id: s.id, status: "paid" })}>支払完了</Button>
                  )}
                </td>
              </tr>
            ))}
            {(!settlementsQuery.data || settlementsQuery.data.length === 0) && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">結算データがありません</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent>
          <DialogHeader><DialogTitle>結算書生成</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>主播ID</Label><Input type="number" value={genForm.anchorId} onChange={e => setGenForm({ ...genForm, anchorId: e.target.value })} /></div>
            <div><Label>開始日</Label><Input type="date" value={genForm.periodStart} onChange={e => setGenForm({ ...genForm, periodStart: e.target.value })} /></div>
            <div><Label>終了日</Label><Input type="date" value={genForm.periodEnd} onChange={e => setGenForm({ ...genForm, periodEnd: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>キャンセル</Button>
            <Button onClick={() => generateMutation.mutate({ liverId: Number(genForm.anchorId), periodStart: genForm.periodStart, periodEnd: genForm.periodEnd })} disabled={generateMutation.isPending || !genForm.anchorId || !genForm.periodStart || !genForm.periodEnd}>
              {generateMutation.isPending ? "生成中..." : "生成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== Main Page ====================
export default function SelectionCenter() {
  const dashboardQuery = trpc.selectionCenter.getDashboard.useQuery();
  const d = dashboardQuery.data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="h-6 w-6" />
          選品センター
        </h1>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">全商品</p>
            <p className="text-2xl font-bold">{d?.totalProducts || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">公開中</p>
            <p className="text-2xl font-bold text-green-600">{d?.onlineProducts || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">選品数</p>
            <p className="text-2xl font-bold text-blue-600">{d?.totalSelections || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">確認済排期</p>
            <p className="text-2xl font-bold text-purple-600">{d?.confirmedSchedules || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">累計GMV</p>
            <p className="text-2xl font-bold text-orange-600">¥{Number(d?.totalGmv || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products"><Package className="h-4 w-4 mr-1" />商品管理</TabsTrigger>
          <TabsTrigger value="liver-selection"><ShoppingBag className="h-4 w-4 mr-1" />主播選品</TabsTrigger>
          <TabsTrigger value="schedules"><Calendar className="h-4 w-4 mr-1" />排期管理</TabsTrigger>
          <TabsTrigger value="performances"><TrendingUp className="h-4 w-4 mr-1" />帯貨データ</TabsTrigger>
          <TabsTrigger value="settlements"><DollarSign className="h-4 w-4 mr-1" />結算管理</TabsTrigger>
        </TabsList>
        <TabsContent value="products"><ProductsTab /></TabsContent>
        <TabsContent value="liver-selection"><LiverSelectionTab /></TabsContent>
        <TabsContent value="schedules"><SchedulesTab /></TabsContent>
        <TabsContent value="performances"><PerformancesTab /></TabsContent>
        <TabsContent value="settlements"><SettlementsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
