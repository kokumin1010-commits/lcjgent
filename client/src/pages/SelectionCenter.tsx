import { useState, useMemo, useEffect } from "react";
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
import { Package, Plus, Search, TrendingUp, Calendar, DollarSign, BarChart3, Edit, Trash2, Eye, CheckCircle, ShoppingBag, Check, X, ImagePlus, Loader2, ScanBarcode, ClipboardList } from "lucide-react";
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
  const liversQuery2 = trpc.selectionCenter.getLivers.useQuery();
  const liversData = liversQuery2.data || [];
  const createMutation = trpc.selectionCenter.createProduct.useMutation({
    onSuccess: () => { productsQuery.refetch(); setShowCreateDialog(false); toast.success("商品を追加しました"); },
  });
  const updateMutation = trpc.selectionCenter.updateProduct.useMutation({
    onSuccess: () => { productsQuery.refetch(); setEditProduct(null); toast.success("商品を更新しました"); },
  });
  const statusMutation = trpc.selectionCenter.updateProductStatus.useMutation({
    onSuccess: () => { productsQuery.refetch(); toast.success("ステータスを更新しました"); },
  });
  const deleteProductMutation = trpc.selectionCenter.deleteProduct.useMutation({
    onSuccess: () => { productsQuery.refetch(); toast.success("商品を削除しました"); },
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
                  <td className="p-3 font-medium max-w-[200px]">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="truncate">{product.productName}</span>
                      {!!product.talentExclusive && <span className="inline-block text-[10px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded font-medium whitespace-nowrap">達人限定</span>}
                    </div>
                    {product.productId && <span className="text-xs text-muted-foreground block">ID: {product.productId}</span>}
                    {!!product.talentExclusive && product.exclusiveLiverIds && (() => {
                      const ids = typeof product.exclusiveLiverIds === 'string' ? JSON.parse(product.exclusiveLiverIds) : product.exclusiveLiverIds;
                      if (!ids || ids.length === 0) return null;
                      return <div className="flex flex-wrap gap-0.5 mt-0.5">{ids.map((id: number) => {
                        const liver = (liversData || []).find((l: any) => l.id === id);
                        return liver ? <span key={id} className="text-[10px] bg-purple-50 text-purple-600 px-1 rounded">{liver.name}</span> : null;
                      })}</div>;
                    })()}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs font-mono">{product.barcode || "-"}</td>
                  <td className="p-3 text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {product.brandName}
                      {product.hasTikTokBackend && <span className="inline-block text-[10px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded font-medium whitespace-nowrap">後台✓</span>}
                    </span>
                  </td>
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
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm("この商品を削除しますか？")) deleteProductMutation.mutate({ id: product.id }); }}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
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
  const brandsQuery = trpc.brand.list.useQuery();
  const liversQuery = trpc.selectionCenter.getLivers.useQuery();

  useEffect(() => {
    if (open) {
      const p = product ? { ...product } : {};
      // Parse exclusiveLiverIds from JSON string if needed
      if (p.exclusiveLiverIds && typeof p.exclusiveLiverIds === 'string') {
        try { p.exclusiveLiverIds = JSON.parse(p.exclusiveLiverIds); } catch { p.exclusiveLiverIds = []; }
      }
      if (!p.exclusiveLiverIds) p.exclusiveLiverIds = [];
      setForm(p);
    }
  }, [open, product]);

  const uploadMutation = trpc.selectionCenter.uploadProductImage.useMutation();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const currentImages: string[] = form.images ? (typeof form.images === 'string' ? JSON.parse(form.images) : form.images) : [];
      for (const file of files) {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        // Extract base64 data and mimeType from data URL (format: data:image/png;base64,xxxxx)
        const [header, base64Data] = dataUrl.split(',');
        const mimeType = header.match(/data:(.*?);/)?.[1] || file.type || 'image/jpeg';
        const result = await uploadMutation.mutateAsync({ base64Data, fileName: file.name, mimeType });
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

  // Only submit relevant fields (exclude DB metadata like createdAt, updatedAt, status, etc.)
  const handleSubmit = () => {
    const submitData: any = {
      productName: form.productName,
      productId: form.productId || undefined,
      barcode: form.barcode || undefined,
      brandName: form.brandName || undefined,
      brandId: form.brandId || undefined,
      categoryId: form.categoryId || undefined,
      price: form.price ? String(form.price) : undefined,
      marketPrice: form.marketPrice ? String(form.marketPrice) : undefined,
      costPrice: form.costPrice ? String(form.costPrice) : undefined,
      commissionType: form.commissionType || undefined,
      commissionValue: form.commissionValue ? String(form.commissionValue) : undefined,
      images: form.images || undefined,
      videos: form.videos || undefined,
      productLink: form.productLink || undefined,
      sellingPoints: form.sellingPoints || undefined,
      description: form.description || undefined,
      stock: form.stock != null && form.stock !== "" ? Number(form.stock) : undefined,
      supplierContact: form.supplierContact || undefined,
      talentExclusive: form.talentExclusive ? 1 : 0,
      exclusiveLiverIds: form.talentExclusive ? (form.exclusiveLiverIds || []) : [],
    };
    // Remove undefined values for cleaner payload
    Object.keys(submitData).forEach(k => { if (submitData[k] === undefined) delete submitData[k]; });
    onSubmit(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "商品編集" : "商品追加"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Image Upload Section */}
          <div>
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

          {/* 商品名 - full width */}
          <div>
            <Label>商品名 *</Label>
            <Input value={form.productName || ""} onChange={e => setForm({ ...form, productName: e.target.value })} />
          </div>

          {/* 商品ID + バーコード - 2 columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>商品ID</Label>
              <Input value={form.productId || ""} onChange={e => setForm({ ...form, productId: e.target.value })} placeholder="TikTok Shop商品ID" />
            </div>
            <div>
              <Label>商品バーコード</Label>
              <Input value={form.barcode || ""} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder="JANコード / EANコード" />
            </div>
          </div>

          {/* ブランド + カテゴリ - 2 columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>ブランド名 *</Label>
              <Select value={String(form.brandId || "")} onValueChange={v => {
                const brand = (brandsQuery.data || []).find((b: any) => String(b.id) === v);
                setForm({ ...form, brandId: Number(v), brandName: brand?.name || "" });
              }}>
                <SelectTrigger><SelectValue placeholder="ブランドを選択..." /></SelectTrigger>
                <SelectContent>
                  {(brandsQuery.data || []).map((b: any) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          </div>

          {/* 販売価格 + 市場価格 - 2 columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>販売価格</Label>
              <Input type="number" value={form.price || ""} onChange={e => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <Label>市場価格</Label>
              <Input type="number" value={form.marketPrice || ""} onChange={e => setForm({ ...form, marketPrice: e.target.value })} />
            </div>
          </div>

          {/* 佣金タイプ + 佣金値 - 2 columns */}
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* 在庫数 + 商品リンク - 2 columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>在庫数</Label>
              <Input type="number" value={form.stock || ""} onChange={e => setForm({ ...form, stock: Number(e.target.value) })} />
            </div>
            <div>
              <Label>商品リンク</Label>
              <Input value={form.productLink || ""} onChange={e => setForm({ ...form, productLink: e.target.value })} />
            </div>
          </div>

          {/* セールスポイント - full width */}
          <div>
            <Label>セールスポイント</Label>
            <Textarea value={form.sellingPoints || ""} onChange={e => setForm({ ...form, sellingPoints: e.target.value })} rows={3} />
          </div>

          {/* サプライヤー連絡先 - full width */}
          <div>
            <Label>サプライヤー連絡先</Label>
            <Input value={form.supplierContact || ""} onChange={e => setForm({ ...form, supplierContact: e.target.value })} />
          </div>

          {/* 達人限定 section - bordered card */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="talentExclusive"
                checked={!!form.talentExclusive}
                onChange={e => {
                  const checked = e.target.checked;
                  setForm({ ...form, talentExclusive: checked ? 1 : 0, exclusiveLiverIds: checked ? (form.exclusiveLiverIds || []) : [] });
                }}
                className="w-4 h-4 rounded border-gray-300"
              />
              <Label htmlFor="talentExclusive" className="cursor-pointer font-medium">達人限定</Label>
            </div>
            {!!form.talentExclusive && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">限定主播を選択:</Label>
                {/* Selected livers display */}
                {(form.exclusiveLiverIds || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(form.exclusiveLiverIds || []).map((liverId: number) => {
                      const liver = (liversQuery.data || []).find((l: any) => l.id === liverId);
                      return liver ? (
                        <span key={liverId} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                          {liver.name}
                          <button type="button" onClick={() => setForm({ ...form, exclusiveLiverIds: (form.exclusiveLiverIds || []).filter((id: number) => id !== liverId) })} className="hover:text-purple-900">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
                {/* Liver picker dropdown */}
                <Select key={`liver-picker-${(form.exclusiveLiverIds || []).length}`} onValueChange={v => {
                  const id = Number(v);
                  if (!form.exclusiveLiverIds?.includes(id)) {
                    setForm({ ...form, exclusiveLiverIds: [...(form.exclusiveLiverIds || []), id] });
                  }
                }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="主播を追加..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(liversQuery.data || []).filter((l: any) => !(form.exclusiveLiverIds || []).includes(l.id)).map((l: any) => (
                      <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleSubmit} disabled={loading || uploading || !form.productName || !form.brandId}>
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
  const [detailProduct, setDetailProduct] = useState<any>(null);

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
            <Card key={product.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetailProduct(product)}>
              {/* Product Image */}
              {(() => {
                try {
                  const imgs = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
                  if (Array.isArray(imgs) && imgs.length > 0) {
                    return (
                      <div className="w-full aspect-[16/9] overflow-hidden bg-muted">
                        <img
                          src={imgs[0]}
                          alt={product.productName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    );
                  }
                  return null;
                } catch { return null; }
              })()}
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{product.productName}</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      {product.brandName}
                      {product.hasTikTokBackend && <span className="inline-block text-[10px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded font-medium">後台✓</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-sm flex-wrap">
                      <span className="font-bold text-orange-600 text-base">¥{Number(product.price || 0).toLocaleString()}</span>
                      {product.marketPrice && Number(product.marketPrice) > 0 && Number(product.marketPrice) !== Number(product.price || 0) && (
                        <span className="text-muted-foreground line-through text-xs">¥{Number(product.marketPrice).toLocaleString()}</span>
                      )}
                      {product.marketPrice && Number(product.marketPrice) > Number(product.price || 0) && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 shrink-0">
                          {Math.round((1 - Number(product.price || 0) / Number(product.marketPrice)) * 100)}%OFF
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm">
                      <Badge variant="outline" className="text-xs">
                        佣金: {product.commissionType === "percentage" ? `${product.commissionValue}%` : `¥${product.commissionValue}`}
                        {product.commissionType === "percentage" && product.price && product.commissionValue && (
                          <span className="ml-1 text-orange-600 font-medium">
                            (¥{Math.round(Number(product.price) * Number(product.commissionValue) / 100).toLocaleString()})
                          </span>
                        )}
                      </Badge>
                    </div>
                    {product.sellingPoints && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{product.sellingPoints}</p>
                    )}
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
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

      {/* Product Detail Dialog */}
      <Dialog open={!!detailProduct} onOpenChange={(open) => { if (!open) setDetailProduct(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailProduct?.productName}</DialogTitle>
          </DialogHeader>
          {detailProduct && (
            <div className="space-y-4">
              {/* Images */}
              {(() => {
                try {
                  const imgs = typeof detailProduct.images === 'string' ? JSON.parse(detailProduct.images) : detailProduct.images;
                  if (Array.isArray(imgs) && imgs.length > 0) {
                    return (
                      <div className="grid grid-cols-2 gap-2">
                        {imgs.map((img: string, idx: number) => (
                          <div key={idx} className="aspect-square overflow-hidden rounded-lg bg-muted">
                            <img src={img} alt={`${detailProduct.productName} ${idx + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                } catch { return null; }
              })()}

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">ブランド</Label>
                  <p className="font-medium">{detailProduct.brandName || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">バーコード</Label>
                  <p className="font-medium">{detailProduct.barcode || '-'}</p>
                </div>
              </div>

              {/* Price Info */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2">価格情報</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">販売価格</Label>
                    <p className="font-bold text-orange-600 text-lg">¥{Number(detailProduct.price || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">市場価格</Label>
                    <p className="font-medium text-muted-foreground line-through">¥{Number(detailProduct.marketPrice || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">割引率</Label>
                    <p className="font-bold text-red-600">
                      {detailProduct.marketPrice && Number(detailProduct.marketPrice) > Number(detailProduct.price || 0)
                        ? `${Math.round((1 - Number(detailProduct.price || 0) / Number(detailProduct.marketPrice)) * 100)}%OFF`
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Commission */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">佣金</Label>
                  <p className="font-medium">
                    {detailProduct.commissionType === 'percentage' ? `${detailProduct.commissionValue}%` : `¥${detailProduct.commissionValue}`}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">在庫</Label>
                  <p className="font-medium">{detailProduct.stock || 0}</p>
                </div>
              </div>

              {/* Selling Points */}
              {detailProduct.sellingPoints && (
                <div>
                  <Label className="text-muted-foreground text-xs">セールスポイント</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{detailProduct.sellingPoints}</p>
                </div>
              )}

              {/* Description */}
              {detailProduct.description && (
                <div>
                  <Label className="text-muted-foreground text-xs">商品説明</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{detailProduct.description}</p>
                </div>
              )}

              {/* Product Link */}
              {detailProduct.productLink && (
                <div>
                  <Label className="text-muted-foreground text-xs">商品リンク</Label>
                  <a href={detailProduct.productLink} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">{detailProduct.productLink}</a>
                </div>
              )}

              {/* Brand Performance History */}
              {detailProduct.brandName && (
                <BrandPerformancePanel brandName={detailProduct.brandName} productName={detailProduct.productName} />
              )}

              {/* Select button */}
              <div className="flex justify-end pt-2">
                {!selectedLiverId ? (
                  <Button variant="outline" disabled>主播を選択してください</Button>
                ) : selectedProductIds.has(detailProduct.id) ? (
                  <Button variant="secondary" disabled><Check className="h-4 w-4 mr-1" />選品済</Button>
                ) : (
                  <Button onClick={() => { selectMutation.mutate({ productId: detailProduct.id, liverId: Number(selectedLiverId) }); setDetailProduct(null); }} disabled={selectMutation.isPending}>
                    選品する
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>


    </div>
  );
}

// ==================== Selections Tab ====================
function SelectionsTab() {
  const selectionsQuery = trpc.selectionCenter.getSelections.useQuery();
  const deleteMutation = trpc.selectionCenter.deleteSelection.useMutation({
    onSuccess: () => {
      selectionsQuery.refetch();
      toast.success("選品を取消しました");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">選品一覧（{selectionsQuery.data?.length || 0}件）</h3>
      </div>
      {selectionsQuery.isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !selectionsQuery.data || selectionsQuery.data.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">選品データがありません</CardContent></Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">主播</th>
                <th className="text-left p-3 font-medium">商品名</th>
                <th className="text-left p-3 font-medium">ブランド</th>
                <th className="text-center p-3 font-medium">販売価格</th>
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
                  <td className="p-3 text-center text-orange-600 font-medium">
                    {s.price ? `¥${Number(s.price).toLocaleString()}` : "-"}
                  </td>
                  <td className="p-3 text-center">
                    {s.commissionType === "percentage"
                      ? <span>{s.commissionValue}% <span className="text-orange-600">(¥{Math.round(Number(s.price || 0) * Number(s.commissionValue || 0) / 100).toLocaleString()})</span></span>
                      : `¥${s.commissionValue}`}
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
      )}
    </div>
  );
}

// ==================== Schedules Tab ====================
function SchedulesTab() {
  const schedulesQuery = trpc.selectionCenter.getSchedules.useQuery();
  const productsQuery = trpc.selectionCenter.getProducts.useQuery({ page: 1, pageSize: 200 });
  const liversQuery = trpc.selectionCenter.getLivers.useQuery();
  const updateMutation = trpc.selectionCenter.updateSchedule.useMutation({
    onSuccess: () => { schedulesQuery.refetch(); toast.success("排期を更新しました"); },
  });
  const createMutation = trpc.selectionCenter.createSchedule.useMutation({
    onSuccess: () => { schedulesQuery.refetch(); toast.success("排期を追加しました"); setShowCreateDialog(false); resetForm(); },
  });

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formAnchorId, setFormAnchorId] = useState<string>("");
  const [formProductId, setFormProductId] = useState<string>("");
  const [formLiveDate, setFormLiveDate] = useState<string>("");
  const [formStartTime, setFormStartTime] = useState<string>("");
  const [formEndTime, setFormEndTime] = useState<string>("");
  const [formSlotOrder, setFormSlotOrder] = useState<string>("");

  const resetForm = () => {
    setFormAnchorId(""); setFormProductId(""); setFormLiveDate(""); setFormStartTime(""); setFormEndTime(""); setFormSlotOrder("");
  };

  const handleCreate = () => {
    if (!formAnchorId || !formProductId || !formLiveDate) {
      toast.error("主播、商品、配信日は必須です"); return;
    }
    createMutation.mutate({
      anchorId: Number(formAnchorId),
      productId: Number(formProductId),
      liveDate: formLiveDate,
      startTime: formStartTime || undefined,
      endTime: formEndTime || undefined,
      slotOrder: formSlotOrder ? Number(formSlotOrder) : undefined,
    });
  };

  // Group schedules by date
  const groupedSchedules = useMemo(() => {
    if (!schedulesQuery.data) return {};
    const groups: Record<string, any[]> = {};
    schedulesQuery.data.forEach((s: any) => {
      const date = s.liveDate?.split('T')[0] || s.liveDate;
      if (!groups[date]) groups[date] = [];
      groups[date].push(s);
    });
    return groups;
  }, [schedulesQuery.data]);

  const getLiverName = (anchorId: number) => {
    const liver = liversQuery.data?.find((l: any) => l.id === anchorId);
    return liver?.name || `ID: ${anchorId}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">排期管理</h3>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />排期追加</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>排期追加</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>主播 *</Label>
                <Select value={formAnchorId} onValueChange={setFormAnchorId}>
                  <SelectTrigger><SelectValue placeholder="主播を選択" /></SelectTrigger>
                  <SelectContent>
                    {liversQuery.data?.map((liver: any) => (
                      <SelectItem key={liver.id} value={String(liver.id)}>{liver.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>商品 *</Label>
                <Select value={formProductId} onValueChange={setFormProductId}>
                  <SelectTrigger><SelectValue placeholder="商品を選択" /></SelectTrigger>
                  <SelectContent>
                    {productsQuery.data?.items?.map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.productName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>配信日 *</Label>
                <Input type="date" value={formLiveDate} onChange={(e) => setFormLiveDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>開始時間</Label>
                  <Input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} />
                </div>
                <div>
                  <Label>終了時間</Label>
                  <Input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>順番</Label>
                <Input type="number" placeholder="1, 2, 3..." value={formSlotOrder} onChange={(e) => setFormSlotOrder(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>キャンセル</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                追加
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {Object.keys(groupedSchedules).length > 0 ? (
        Object.entries(groupedSchedules).sort(([a], [b]) => b.localeCompare(a)).map(([date, items]) => (
          <div key={date} className="border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-4 py-2 font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {date}
              <Badge variant="outline" className="ml-auto">{items.length}件</Badge>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left p-3 font-medium">主播</th>
                  <th className="text-left p-3 font-medium">商品</th>
                  <th className="text-center p-3 font-medium">時間帯</th>
                  <th className="text-center p-3 font-medium">順番</th>
                  <th className="text-center p-3 font-medium">ステータス</th>
                  <th className="text-center p-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.sort((a: any, b: any) => (a.slotOrder || 99) - (b.slotOrder || 99)).map((schedule: any) => (
                  <tr key={schedule.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-medium">{getLiverName(schedule.anchorId)}</td>
                    <td className="p-3">{schedule.product?.productName || "-"}</td>
                    <td className="p-3 text-center">{schedule.startTime || "-"} ~ {schedule.endTime || "-"}</td>
                    <td className="p-3 text-center">{schedule.slotOrder || "-"}</td>
                    <td className="p-3 text-center">
                      <Badge variant={schedule.status === "confirmed" ? "default" : schedule.status === "done" ? "secondary" : "outline"}>
                        {schedule.status === "pending" ? "未確認" : schedule.status === "confirmed" ? "確認済" : schedule.status === "done" ? "完了" : "キャンセル"}
                      </Badge>
                    </td>
                    <td className="p-3 text-center space-x-1">
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
                      {(schedule.status === "pending" || schedule.status === "confirmed") && (
                        <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ id: schedule.id, status: "cancelled" })}>
                          <X className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      ) : (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          排期データがありません。「排期追加」ボタンから新しい排期を作成してください。
        </div>
      )}
    </div>
  );
}

// ==================== Performances Tab ====================
function PerformancesTab() {
  const [search, setSearch] = useState("");
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"products" | "daily" | "imports">("products");
  const [expandedLivestream, setExpandedLivestream] = useState<number | null>(null);
  const [selectedStreamer, setSelectedStreamer] = useState<string>("Ryu kyogoku");
  const [sortMode, setSortMode] = useState<"potential" | "gmv" | "impressions">("potential");
  
  const streamerNamesQuery = trpc.selectionCenter.getStreamerNames.useQuery();
  const streamerFilter = selectedStreamer && selectedStreamer !== '__all__' ? selectedStreamer : undefined;
  const performanceQuery = trpc.selectionCenter.getProductPerformanceHistory.useQuery({
    search: search || undefined,
    streamerName: streamerFilter,
  });
  const importHistoryQuery = trpc.selectionCenter.getAllImportHistory.useQuery({});
  const dailyViewQuery = trpc.selectionCenter.getDailyPerformanceView.useQuery({
    streamerName: streamerFilter,
  });
  const dailyProductsQuery = trpc.selectionCenter.getDailyViewProducts.useQuery(
    { livestreamId: expandedLivestream! },
    { enabled: !!expandedLivestream }
  );

  const rawProducts = performanceQuery.data || [];
  const importHistory = importHistoryQuery.data || [];
  const dailyData = dailyViewQuery.data || [];
  const streamerNames = streamerNamesQuery.data || [];

  // Sort products based on selected mode
  const products = [...rawProducts].sort((a, b) => {
    if (sortMode === 'potential') {
      // Potential score: (impressions * clicks) / (gmv + 1) - higher = more potential
      const scoreA = (a.totalImpressions * a.totalClicks) / (a.totalGmv + 1);
      const scoreB = (b.totalImpressions * b.totalClicks) / (b.totalGmv + 1);
      return scoreB - scoreA;
    } else if (sortMode === 'gmv') {
      return b.totalGmv - a.totalGmv;
    } else {
      return b.totalImpressions - a.totalImpressions;
    }
  });
  // Top 3 potential products get badge
  const potentialTop3 = sortMode === 'potential' ? products.slice(0, 3).map(p => p.productName) : [];

  return (
    <div className="space-y-4">
      {/* Header with streamer filter */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold">帯貨データ・全商品パフォーマンス</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">ストリーマー:</span>
          <Select value={selectedStreamer} onValueChange={(v) => { setSelectedStreamer(v); setExpandedProduct(null); setExpandedLivestream(null); }}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="全員" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全員（{streamerNames.reduce((s, n) => s + n.count, 0)}配信）</SelectItem>
              {streamerNames.map((s) => (
                <SelectItem key={s.name} value={s.name}>{s.name}（{s.count}配信）</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Button 
          variant={activeSubTab === "products" ? "default" : "ghost"} 
          size="sm"
          onClick={() => setActiveSubTab("products")}
        >
          <BarChart3 className="h-4 w-4 mr-1" />商品パフォーマンス
        </Button>
        <Button 
          variant={activeSubTab === "daily" ? "default" : "ghost"} 
          size="sm"
          onClick={() => setActiveSubTab("daily")}
        >
          <Calendar className="h-4 w-4 mr-1" />日別ビュー
        </Button>
        <Button 
          variant={activeSubTab === "imports" ? "default" : "ghost"} 
          size="sm"
          onClick={() => setActiveSubTab("imports")}
        >
          <ClipboardList className="h-4 w-4 mr-1" />インポート履歴
        </Button>
      </div>

      {activeSubTab === "products" && (
        <>
          {/* Search + Sort */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="商品名で検索..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1">
              <Button
                variant={sortMode === 'potential' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortMode('potential')}
                className="text-xs"
              >
                🎯 ポテンシャル順
              </Button>
              <Button
                variant={sortMode === 'gmv' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortMode('gmv')}
                className="text-xs"
              >
                GMV順
              </Button>
              <Button
                variant={sortMode === 'impressions' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortMode('impressions')}
                className="text-xs"
              >
                インプ順
              </Button>
            </div>
          </div>

          {/* Summary cards */}
          {products.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">全商品数</p>
                  <p className="text-xl font-bold">{products.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">累計GMV</p>
                  <p className="text-xl font-bold text-yellow-500">¥{products.reduce((s, p) => s + p.totalGmv, 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">累計販売数</p>
                  <p className="text-xl font-bold">{products.reduce((s, p) => s + p.totalItemsSold, 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">累計インプ</p>
                  <p className="text-xl font-bold">{products.reduce((s, p) => s + p.totalImpressions, 0).toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Product list */}
          <div className="space-y-2">
            {products.map((product) => {
              const isExpanded = expandedProduct === product.productName;
              return (
                <div key={product.productName} className="border rounded-lg overflow-hidden">
                  {/* Product summary row */}
                  <div 
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedProduct(isExpanded ? null : product.productName)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{product.productName}</p>
                        {potentialTop3.includes(product.productName) && (
                          <Badge className="text-[10px] px-1.5 py-0 h-4 shrink-0 bg-emerald-600 text-white">
                            🎯 ライブ推奨
                          </Badge>
                        )}
                        {(product as any).impressionSpike && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                            🔥 インプ急上昇
                          </Badge>
                        )}
                        {(product as any).clickSpike && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 shrink-0 bg-orange-500">
                            🔥 クリック急上昇
                          </Badge>
                        )}
                        {(product as any).highImpLowSales && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 border-yellow-500 text-yellow-500">
                            ⚠️ 高インプ低売上
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {product.livestreamCount}回配信 ・ 平均単価 ¥{product.totalItemsSold > 0 ? Math.round(product.totalGmv / product.totalItemsSold).toLocaleString() : '0'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-right text-xs">
                      <div>
                        <p className="text-muted-foreground">GMV</p>
                        <p className="font-semibold text-yellow-500">¥{product.totalGmv.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">販売数</p>
                        <p className="font-semibold">{product.totalItemsSold.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">インプ</p>
                        <p className="font-semibold">{product.totalImpressions.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">クリック</p>
                        <p className="font-semibold">{product.totalClicks.toLocaleString()}</p>
                      </div>
                      <div className="w-5">
                        <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded: daily breakdown */}
                  {isExpanded && (
                    <div className="border-t bg-muted/20">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40">
                            <tr>
                              <th className="text-left p-2 font-medium">配信日</th>
                              <th className="text-left p-2 font-medium">主播</th>
                              <th className="text-right p-2 font-medium">販売単価</th>
                              <th className="text-right p-2 font-medium">売上(GMV)</th>
                              <th className="text-right p-2 font-medium">販売数</th>
                              <th className="text-right p-2 font-medium">インプ</th>
                              <th className="text-right p-2 font-medium">クリック</th>
                              <th className="text-right p-2 font-medium">CTR</th>
                              <th className="text-right p-2 font-medium">CTOR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {product.history.map((h, idx) => {
                              const calcPrice = h.itemsSold > 0 ? Math.round(h.gmv / h.itemsSold) : (h.unitPrice || 0);
                              const prevH = idx < product.history.length - 1 ? product.history[idx + 1] : null;
                              const prevPrice = prevH ? (prevH.itemsSold > 0 ? Math.round(prevH.gmv / prevH.itemsSold) : (prevH.unitPrice || 0)) : null;
                              const priceChange = prevPrice && calcPrice ? calcPrice - prevPrice : null;
                              return (
                                <tr key={`${h.livestreamId}-${idx}`} className="border-t hover:bg-muted/30">
                                  <td className="p-2">{h.date ? new Date(h.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : '-'}</td>
                                  <td className="p-2">{h.streamerName || '-'}</td>
                                  <td className="p-2 text-right font-medium">
                                    ¥{calcPrice.toLocaleString()}
                                    {priceChange !== null && priceChange !== 0 && (
                                      <span className={`ml-1 text-[10px] ${priceChange > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                        {priceChange > 0 ? '↑' : '↓'}{Math.abs(priceChange).toLocaleString()}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2 text-right text-yellow-500 font-medium">¥{h.gmv.toLocaleString()}</td>
                                  <td className="p-2 text-right">{h.itemsSold.toLocaleString()}</td>
                                  <td className="p-2 text-right">{h.impressions.toLocaleString()}</td>
                                  <td className="p-2 text-right">{h.clicks.toLocaleString()}</td>
                                  <td className="p-2 text-right">{h.ctr ? `${(parseFloat(h.ctr) * 100).toFixed(1)}%` : '-'}</td>
                                  <td className="p-2 text-right">{h.ctor ? `${(parseFloat(h.ctor) * 100).toFixed(1)}%` : '-'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {products.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {performanceQuery.isLoading ? 'データ読み込み中...' : '帯貨データがありません。配信詳細ページからCSVをインポートしてください。'}
              </div>
            )}
          </div>
        </>
      )}

      {activeSubTab === "daily" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">日付別の配信パフォーマンス一覧（クリックで商品詳細を表示）</p>
          
          {/* Daily summary cards */}
          {dailyData.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">配信回数</p>
                  <p className="text-xl font-bold">{dailyData.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">総合GMV</p>
                  <p className="text-xl font-bold text-yellow-500">¥{dailyData.reduce((s, d) => s + d.totalGmv, 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">総合インプ</p>
                  <p className="text-xl font-bold">{dailyData.reduce((s, d) => s + d.totalImpressions, 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">平均商品数/配信</p>
                  <p className="text-xl font-bold">{dailyData.length > 0 ? Math.round(dailyData.reduce((s, d) => s + d.productCount, 0) / dailyData.length) : 0}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Daily list */}
          <div className="space-y-2">
            {dailyData.map((day) => {
              const isExpanded = expandedLivestream === day.livestreamId;
              return (
                <div key={day.livestreamId} className="border rounded-lg overflow-hidden">
                  <div 
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedLivestream(isExpanded ? null : day.livestreamId)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">
                          {day.date ? new Date(day.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' }) : '-'}
                        </p>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {day.streamerName || '不明'}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {day.productCount}商品
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right text-xs">
                      <div>
                        <p className="text-muted-foreground">GMV</p>
                        <p className="font-semibold text-yellow-500">¥{day.totalGmv.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">販売数</p>
                        <p className="font-semibold">{day.totalItems.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">インプ</p>
                        <p className="font-semibold">{day.totalImpressions.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">クリック</p>
                        <p className="font-semibold">{day.totalClicks.toLocaleString()}</p>
                      </div>
                      <div className="w-5">
                        <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded: products for this day */}
                  {isExpanded && (
                    <div className="border-t bg-muted/20">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40">
                            <tr>
                              <th className="text-left p-2 font-medium">商品名</th>
                              <th className="text-right p-2 font-medium">単価</th>
                              <th className="text-right p-2 font-medium">GMV</th>
                              <th className="text-right p-2 font-medium">販売数</th>
                              <th className="text-right p-2 font-medium">インプ</th>
                              <th className="text-right p-2 font-medium">クリック</th>
                              <th className="text-right p-2 font-medium">CTR</th>
                              <th className="text-right p-2 font-medium">CTOR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dailyProductsQuery.isLoading ? (
                              <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">読み込み中...</td></tr>
                            ) : (dailyProductsQuery.data || []).map((p, idx) => {
                              const calcPrice = p.itemsSold > 0 ? Math.round(p.gmv / p.itemsSold) : (p.unitPrice || 0);
                              return (
                                <tr key={idx} className="border-t hover:bg-muted/30">
                                  <td className="p-2 max-w-[200px] truncate">{p.productName}</td>
                                  <td className="p-2 text-right">¥{calcPrice.toLocaleString()}</td>
                                  <td className="p-2 text-right text-yellow-500 font-medium">¥{p.gmv.toLocaleString()}</td>
                                  <td className="p-2 text-right">{p.itemsSold.toLocaleString()}</td>
                                  <td className="p-2 text-right">{p.impressions.toLocaleString()}</td>
                                  <td className="p-2 text-right">{p.clicks.toLocaleString()}</td>
                                  <td className="p-2 text-right">{p.ctr ? `${(parseFloat(p.ctr) * 100).toFixed(1)}%` : '-'}</td>
                                  <td className="p-2 text-right">{p.ctor ? `${(parseFloat(p.ctor) * 100).toFixed(1)}%` : '-'}</td>
                                </tr>
                              );
                            })}
                            {!dailyProductsQuery.isLoading && (dailyProductsQuery.data || []).length === 0 && (
                              <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">商品データなし</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {dailyData.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {dailyViewQuery.isLoading ? 'データ読み込み中...' : '日別データがありません。'}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === "imports" && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">全てのCSVインポート履歴（ダウンロード可能）</p>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">ファイル名</th>
                  <th className="text-left p-3 font-medium">配信日</th>
                  <th className="text-left p-3 font-medium">主播</th>
                  <th className="text-right p-3 font-medium">商品数</th>
                  <th className="text-right p-3 font-medium">GMV</th>
                  <th className="text-left p-3 font-medium">インポート者</th>
                  <th className="text-left p-3 font-medium">日時</th>
                  <th className="text-center p-3 font-medium">DL</th>
                </tr>
              </thead>
              <tbody>
                {importHistory.map((h: any) => (
                  <tr key={h.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 text-xs max-w-[200px] truncate">{h.fileName}</td>
                    <td className="p-3 text-xs">{h.livestreamDate ? new Date(h.livestreamDate).toLocaleDateString('ja-JP') : '-'}</td>
                    <td className="p-3 text-xs">{h.streamerName || '-'}</td>
                    <td className="p-3 text-right">{h.productCount}</td>
                    <td className="p-3 text-right text-yellow-500">¥{Number(h.totalGmv || 0).toLocaleString()}</td>
                    <td className="p-3 text-xs">{h.importedByName}</td>
                    <td className="p-3 text-xs">{new Date(h.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</td>
                    <td className="p-3 text-center">
                      {h.fileUrl ? (
                        <a href={h.fileUrl} download className="text-blue-400 hover:text-blue-300 underline text-xs">DL</a>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {importHistory.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">インポート履歴がありません</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
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

// ==================== Brand Performance Panel (for detail dialog) ====================
function BrandPerformancePanel({ brandName, productName }: { brandName: string; productName: string }) {
  const [expanded, setExpanded] = useState(false);
  const perfQuery = trpc.selectionCenter.getBrandPerformanceSummary.useQuery(
    { brandName },
    { enabled: expanded }
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-900">帯貨履歴データ</span>
          <Badge variant="outline" className="text-[10px]">{brandName}</Badge>
        </div>
        <span className="text-xs text-muted-foreground">{expanded ? '▲ 閉じる' : '▼ 展開'}</span>
      </button>
      {expanded && (
        <div className="p-3 space-y-3">
          {perfQuery.isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="ml-2 text-sm text-muted-foreground">データ取得中...</span>
            </div>
          )}
          {perfQuery.data && !perfQuery.data.found && (
            <p className="text-sm text-muted-foreground text-center py-3">このブランドの帯貨データはまだありません</p>
          )}
          {perfQuery.data?.found && perfQuery.data.summary && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-orange-50 rounded p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">GMV</p>
                  <p className="text-sm font-bold text-orange-600">¥{perfQuery.data.summary.totalGmv.toLocaleString()}</p>
                </div>
                <div className="bg-blue-50 rounded p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">インプ</p>
                  <p className="text-sm font-bold text-blue-600">{perfQuery.data.summary.totalImpressions.toLocaleString()}</p>
                </div>
                <div className="bg-green-50 rounded p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">CTR</p>
                  <p className="text-sm font-bold text-green-600">{perfQuery.data.summary.avgCtr}%</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-purple-50 rounded p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">販売数</p>
                  <p className="text-sm font-bold text-purple-600">{perfQuery.data.summary.totalSales.toLocaleString()}</p>
                </div>
                <div className="bg-pink-50 rounded p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">クリック</p>
                  <p className="text-sm font-bold text-pink-600">{perfQuery.data.summary.totalClicks.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">配信回数</p>
                  <p className="text-sm font-bold">{perfQuery.data.summary.totalStreams}</p>
                </div>
              </div>
              {/* Top products */}
              {perfQuery.data.products.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-muted-foreground mb-1">商品別実績 (TOP {Math.min(perfQuery.data.products.length, 10)})</h5>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {perfQuery.data.products.slice(0, 10).map((p: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted/50">
                        <span className="truncate flex-1 mr-2">{p.productName}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-orange-600 font-medium">¥{p.totalGmv.toLocaleString()}</span>
                          <span className="text-muted-foreground">{p.streamCount}回</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== Main Page ====================
export default function SelectionCenter() {
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'products';
  });
  const dashboardQuery = trpc.selectionCenter.getDashboard.useQuery();
  const d = dashboardQuery.data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="h-6 w-6" />
          選品センター
        </h1>
        <a href="/barcode-scanner" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">
            <ScanBarcode className="h-4 w-4 mr-1" />
            バーコード検索
          </Button>
        </a>
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
      <Tabs value={activeTab} onValueChange={(val) => {
        setActiveTab(val);
        const params = new URLSearchParams(window.location.search);
        params.set('tab', val);
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
      }} className="space-y-4">
        <TabsList>
          <TabsTrigger value="products"><Package className="h-4 w-4 mr-1" />商品管理</TabsTrigger>
          <TabsTrigger value="liver-selection"><ShoppingBag className="h-4 w-4 mr-1" />主播選品</TabsTrigger>
          <TabsTrigger value="schedules"><Calendar className="h-4 w-4 mr-1" />排期管理</TabsTrigger>
          <TabsTrigger value="performances"><TrendingUp className="h-4 w-4 mr-1" />帯貨データ</TabsTrigger>
          <TabsTrigger value="settlements"><DollarSign className="h-4 w-4 mr-1" />結算管理</TabsTrigger>
          <TabsTrigger value="selections"><ClipboardList className="h-4 w-4 mr-1" />選品一覧</TabsTrigger>
        </TabsList>
        <TabsContent value="products"><ProductsTab /></TabsContent>
        <TabsContent value="liver-selection"><LiverSelectionTab /></TabsContent>
        <TabsContent value="schedules"><SchedulesTab /></TabsContent>
        <TabsContent value="performances"><PerformancesTab /></TabsContent>
        <TabsContent value="settlements"><SettlementsTab /></TabsContent>
        <TabsContent value="selections"><SelectionsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
