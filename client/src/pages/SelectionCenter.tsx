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
import { Package, Plus, Search, TrendingUp, Calendar, DollarSign, BarChart3, Edit, Trash2, Eye, CheckCircle, ShoppingBag, Check, X, ImagePlus, Loader2, ScanBarcode, ClipboardList, Zap } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

// ==================== Products Tab ====================
function ProductsTab() {
  const { t } = useLanguage();
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
    onSuccess: () => { productsQuery.refetch(); setShowCreateDialog(false); toast.success(t("sc.productAdded")); },
  });
  const updateMutation = trpc.selectionCenter.updateProduct.useMutation({
    onSuccess: () => { productsQuery.refetch(); setEditProduct(null); toast.success(t("sc.productUpdated")); },
  });
  const statusMutation = trpc.selectionCenter.updateProductStatus.useMutation({
    onSuccess: () => { productsQuery.refetch(); toast.success(t("sc.statusUpdated")); },
  });
  const deleteProductMutation = trpc.selectionCenter.deleteProduct.useMutation({
    onSuccess: () => { productsQuery.refetch(); toast.success(t("sc.productDeleted")); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("sc.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("sc.all")}</SelectItem>
            <SelectItem value="draft">{t("sc.draft")}</SelectItem>
            <SelectItem value="online">{t("sc.online")}</SelectItem>
            <SelectItem value="offline">{t("sc.offline")}</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowCreateDialog(true)}><Plus className="h-4 w-4 mr-1" />{t("sc.addProduct")}</Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium w-12">{t("sc.image")}</th>
              <th className="text-left p-3 font-medium">{t("sc.productName")}</th>
              <th className="text-left p-3 font-medium">{t("sc.barcode")}</th>
              <th className="text-left p-3 font-medium">{t("sc.brand")}</th>
              <th className="text-left p-3 font-medium">{t("sc.category")}</th>
              <th className="text-right p-3 font-medium">{t("sc.price")}</th>
              <th className="text-right p-3 font-medium">{t("sc.commission")}</th>
              <th className="text-center p-3 font-medium">{t("sc.stock")}</th>
              <th className="text-center p-3 font-medium">{t("sc.status")}</th>
              <th className="text-center p-3 font-medium">{t("sc.actions")}</th>
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
                      {!!product.talentExclusive && <span className="inline-block text-[10px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded font-medium whitespace-nowrap">{t("sc.talentExclusive")}</span>}
                    </div>
                    {product.productId && <span className="text-xs text-muted-foreground block">ID: {product.productId}</span>}
                    {(() => {
                      const tags: string[] = product.tags ? (typeof product.tags === 'string' ? JSON.parse(product.tags) : product.tags) : [];
                      if (tags.length === 0) return null;
                      return <div className="flex flex-wrap gap-0.5 mt-0.5">{tags.map((t: string) => <span key={t} className="text-[10px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded font-medium">{t}</span>)}</div>;
                    })()}
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
                      {product.hasTikTokBackend && <span className="inline-block text-[10px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded font-medium whitespace-nowrap">{t("sc.tiktokBackend")}</span>}
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
                      {product.status === "online" ? t("sc.online") : product.status === "draft" ? t("sc.draft") : t("sc.offline")}
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
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm(t("sc.deleteConfirm"))) deleteProductMutation.mutate({ id: product.id }); }}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {(!productsQuery.data?.items || productsQuery.data.items.length === 0) && (
              <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">{t("sc.noProducts")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">{t("sc.totalItems").replace("{count}", String(productsQuery.data?.total || 0))}</p>

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
  const { t } = useLanguage();
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
      toast.success(`${files.length}${t("sc.form.imageUploaded")}`);
    } catch (err: any) {
      toast.error(err?.message || t("sc.form.imageUploadFailed"));
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
      tags: form.tags && form.tags.length > 0 ? form.tags : [],
    };
    // Remove undefined values for cleaner payload
    Object.keys(submitData).forEach(k => { if (submitData[k] === undefined) delete submitData[k]; });
    onSubmit(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("sc.form.editTitle") : t("sc.form.addTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Image Upload Section */}
          <div>
            <Label>{t("sc.form.productImage")}</Label>
            <div className="mt-2 flex flex-wrap gap-3">
              {imageList.map((url: string, idx: number) => (
                <div key={idx} className="relative group w-20 h-20 rounded-lg border overflow-hidden">
                  <img src={url} alt={`${t("sc.form.imageAlt")} ${idx + 1}`} className="w-full h-full object-cover" />
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
                    <span className="text-[10px] text-muted-foreground mt-1">{t("sc.form.addImage")}</span>
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
            <Label>{t("sc.form.productNameLabel")}</Label>
            <Input value={form.productName || ""} onChange={e => setForm({ ...form, productName: e.target.value })} />
          </div>

          {/* 商品ID + バーコード - 2 columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("sc.form.productId")}</Label>
              <Input value={form.productId || ""} onChange={e => setForm({ ...form, productId: e.target.value })} placeholder={t("sc.form.productIdPlaceholder")} />
            </div>
            <div>
              <Label>{t("sc.form.barcode")}</Label>
              <Input value={form.barcode || ""} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder={t("sc.form.barcodePlaceholder")} />
            </div>
          </div>

          {/* ブランド + カテゴリ - 2 columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("sc.form.brandName")}</Label>
              <Select value={String(form.brandId || "")} onValueChange={v => {
                const brand = (brandsQuery.data || []).find((b: any) => String(b.id) === v);
                setForm({ ...form, brandId: Number(v), brandName: brand?.name || "" });
              }}>
                <SelectTrigger><SelectValue placeholder={t("sc.form.brandPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {(brandsQuery.data || []).map((b: any) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("sc.form.category")}</Label>
              <Select value={String(form.categoryId || "")} onValueChange={v => setForm({ ...form, categoryId: Number(v) })}>
                <SelectTrigger><SelectValue placeholder={t("sc.form.categoryPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {categories.map((c: any) => { const parent = c.parentId ? categories.find((p: any) => p.id === c.parentId) : null; return <SelectItem key={c.id} value={String(c.id)}>{parent ? parent.name + " / " : ""}{c.name}</SelectItem>; })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 品類タグ */}
          <div>
            <Label>{t("sc.form.tags")}</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {["引流款","福利款","爆品款","KG品牌款","利润款","惊喜款","预告款"].map(tag => {
                const tags: string[] = form.tags ? (typeof form.tags === 'string' ? JSON.parse(form.tags) : form.tags) : [];
                const isSelected = tags.includes(tag);
                return (
                  <button key={tag} type="button" onClick={() => {
                    const newTags = isSelected ? tags.filter((t: string) => t !== tag) : [...tags, tag];
                    setForm({ ...form, tags: newTags });
                  }} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'}`}>
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 販売価格 + 市場価格 - 2 columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("sc.form.sellingPrice")}</Label>
              <Input type="number" value={form.price || ""} onChange={e => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <Label>{t("sc.form.marketPrice")}</Label>
              <Input type="number" value={form.marketPrice || ""} onChange={e => setForm({ ...form, marketPrice: e.target.value })} />
            </div>
          </div>

          {/* 佣金タイプ + 佣金値 - 2 columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("sc.form.commissionType")}</Label>
              <Select value={form.commissionType || "percentage"} onValueChange={v => setForm({ ...form, commissionType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">{t("sc.form.commissionPercentage")}</SelectItem>
                  <SelectItem value="fixed">{t("sc.form.commissionFixed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("sc.form.commissionValue")}</Label>
              <Input type="number" value={form.commissionValue || ""} onChange={e => setForm({ ...form, commissionValue: e.target.value })} />
            </div>
          </div>

          {/* 在庫数 + 商品リンク - 2 columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("sc.form.stock")}</Label>
              <Input type="number" value={form.stock || ""} onChange={e => setForm({ ...form, stock: Number(e.target.value) })} />
            </div>
            <div>
              <Label>{t("sc.form.productLink")}</Label>
              <Input value={form.productLink || ""} onChange={e => setForm({ ...form, productLink: e.target.value })} />
            </div>
          </div>

          {/* セールスポイント - full width */}
          <div>
            <Label>{t("sc.form.sellingPoints")}</Label>
            <Textarea value={form.sellingPoints || ""} onChange={e => setForm({ ...form, sellingPoints: e.target.value })} rows={3} />
          </div>

          {/* サプライヤー連絡先 - full width */}
          <div>
            <Label>{t("sc.form.supplierContact")}</Label>
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
              <Label htmlFor="talentExclusive" className="cursor-pointer font-medium">{t("sc.form.talentExclusive")}</Label>
            </div>
            {!!form.talentExclusive && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t("sc.liver.selectPlaceholder")}</Label>
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
                    <SelectValue placeholder={t("sc.liver.selectPlaceholder")} />
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
          <Button variant="outline" onClick={onClose}>{t("sc.form.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={loading || uploading || !form.productName || !form.brandId}>
            {loading ? t("sc.form.saving") : isEdit ? t("sc.form.update") : t("sc.form.addImage")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ==================== 主播選品 Tab ====================
function LiverSelectionTab() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [selectedLiverId, setSelectedLiverId] = useState<string>("");
  const [detailProduct, setDetailProduct] = useState<any>(null);
  const [tagFilter, setTagFilter] = useState<string>("");

  const productsQuery = trpc.selectionCenter.getLiverAvailableProducts.useQuery({
    search: search || undefined,
  });
  const liversQuery = trpc.selectionCenter.getLivers.useQuery();
  const selectionsQuery = trpc.selectionCenter.getSelections.useQuery();

  const selectMutation = trpc.selectionCenter.liverSelectProduct.useMutation({
    onSuccess: () => {
      selectionsQuery.refetch();
      toast.success(t("sc.liver.selectionSuccess"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = trpc.selectionCenter.deleteSelection.useMutation({
    onSuccess: () => {
      selectionsQuery.refetch();
      toast.success(t("sc.liver.selectionCancelled"));
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
          <Label className="whitespace-nowrap font-medium">{t("sc.liver.label")}</Label>
          <Select value={selectedLiverId} onValueChange={setSelectedLiverId}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder={t("sc.liver.selectPlaceholder")} /></SelectTrigger>
            <SelectContent>
              {(liversQuery.data || []).map((liver: any) => (
                <SelectItem key={liver.id} value={String(liver.id)}>{liver.name}</SelectItem>
              ))}
              {(!liversQuery.data || liversQuery.data.length === 0) && (
                <SelectItem value="__none" disabled>{t("sc.liver.noLivers")}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("sc.liver.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Tag filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTagFilter("")} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!tagFilter ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'}`}>{t("sc.all")}</button>
        {["引流款","福利款","爆品款","KG品牌款","利润款","惊喜款","预告款"].map(tag => (
          <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? "" : tag)} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${tagFilter === tag ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'}`}>{tag}</button>
        ))}
      </div>

      {/* Available products grid */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-3">{t("sc.liver.onlineProducts").replace("{count}", String(productsQuery.data?.filter((p: any) => {
          if (!tagFilter) return true;
          const tags: string[] = p.tags ? (typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags) : [];
          return tags.includes(tagFilter);
        }).length || 0))}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {productsQuery.data?.filter((p: any) => {
            if (!tagFilter) return true;
            const tags: string[] = p.tags ? (typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags) : [];
            return tags.includes(tagFilter);
          }).map((product: any) => (
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
                      {product.hasTikTokBackend && <span className="inline-block text-[10px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded font-medium">{t("sc.tiktokBackend")}</span>}
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
                        {t("sc.commission")}: {product.commissionType === "percentage" ? `${product.commissionValue}%` : `¥${product.commissionValue}`}
                        {product.commissionType === "percentage" && product.price && product.commissionValue && (
                          <span className="ml-1 text-orange-600 font-medium">
                            (¥{Math.round(Number(product.price) * Number(product.commissionValue) / 100).toLocaleString()})
                          </span>
                        )}
                      </Badge>
                    </div>
                    {/* Tag badges */}
                    {(() => {
                      const tags: string[] = product.tags ? (typeof product.tags === 'string' ? JSON.parse(product.tags) : product.tags) : [];
                      if (tags.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {tags.map((tag: string) => (
                            <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700 border border-purple-200">{tag}</span>
                          ))}
                        </div>
                      );
                    })()}
                    {product.sellingPoints && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{product.sellingPoints}</p>
                    )}
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    {!selectedLiverId ? (
                      <Button size="sm" variant="outline" disabled className="text-xs">{t("sc.liver.selectLiver")}</Button>
                    ) : selectedProductIds.has(product.id) ? (
                      <Button size="sm" variant="secondary" disabled><Check className="h-4 w-4 mr-1" />{t("sc.liver.selected")}</Button>
                    ) : (
                      <Button size="sm" onClick={() => selectMutation.mutate({ productId: product.id, liverId: Number(selectedLiverId) })} disabled={selectMutation.isPending}>
                        {t("sc.liver.select")}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!productsQuery.data || productsQuery.data.length === 0) && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              {t("sc.liver.noOnlineProducts")}
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
                  <Label className="text-muted-foreground text-xs">{t("sc.liver.brandLabel")}</Label>
                  <p className="font-medium">{detailProduct.brandName || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">{t("sc.liver.barcodeLabel")}</Label>
                  <p className="font-medium">{detailProduct.barcode || '-'}</p>
                </div>
              </div>

              {/* Price Info */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2">{t("sc.liver.priceInfo")}</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">{t("sc.liver.sellingPrice")}</Label>
                    <p className="font-bold text-orange-600 text-lg">¥{Number(detailProduct.price || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">{t("sc.liver.marketPrice")}</Label>
                    <p className="font-medium text-muted-foreground line-through">¥{Number(detailProduct.marketPrice || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">{t("sc.liver.discount")}</Label>
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
                  <Label className="text-muted-foreground text-xs">{t("sc.liver.commission")}</Label>
                  <p className="font-medium">
                    {detailProduct.commissionType === 'percentage' ? `${detailProduct.commissionValue}%` : `¥${detailProduct.commissionValue}`}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">{t("sc.liver.stock")}</Label>
                  <p className="font-medium">{detailProduct.stock || 0}</p>
                </div>
              </div>

              {/* Selling Points */}
              {detailProduct.sellingPoints && (
                <div>
                  <Label className="text-muted-foreground text-xs">{t("sc.liver.sellingPoints")}</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{detailProduct.sellingPoints}</p>
                </div>
              )}

              {/* Description */}
              {detailProduct.description && (
                <div>
                  <Label className="text-muted-foreground text-xs">{t("sc.liver.description")}</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{detailProduct.description}</p>
                </div>
              )}

              {/* Product Link */}
              {detailProduct.productLink && (
                <div>
                  <Label className="text-muted-foreground text-xs">{t("sc.liver.productLink")}</Label>
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
                  <Button variant="outline" disabled>{t("sc.liver.selectLiverFirst")}</Button>
                ) : selectedProductIds.has(detailProduct.id) ? (
                  <Button variant="secondary" disabled><Check className="h-4 w-4 mr-1" />{t("sc.liver.selected")}</Button>
                ) : (
                  <Button onClick={() => { selectMutation.mutate({ productId: detailProduct.id, liverId: Number(selectedLiverId) }); setDetailProduct(null); }} disabled={selectMutation.isPending}>
                    {t("sc.liver.select")}
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
  const { t } = useLanguage();
  const selectionsQuery = trpc.selectionCenter.getSelections.useQuery();
  const deleteMutation = trpc.selectionCenter.deleteSelection.useMutation({
    onSuccess: () => {
      selectionsQuery.refetch();
      toast.success(t("sc.selections.cancelled"));
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t("sc.selections.title").replace("{count}", String(selectionsQuery.data?.length || 0))}</h3>
      </div>
      {selectionsQuery.isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !selectionsQuery.data || selectionsQuery.data.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">{t("sc.selections.noData")}</CardContent></Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">{t("sc.perf.liverCol")}</th>
                <th className="text-left p-3 font-medium">{t("sc.selections.productName")}</th>
                <th className="text-left p-3 font-medium">{t("sc.selections.brand")}</th>
                <th className="text-center p-3 font-medium">{t("sc.selections.price")}</th>
                <th className="text-center p-3 font-medium">{t("sc.selections.commission")}</th>
                <th className="text-center p-3 font-medium">{t("sc.status")}</th>
                <th className="text-center p-3 font-medium">{t("sc.actions")}</th>
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
                      {s.status === "approved" ? t("sc.selections.approved") : s.status === "rejected" ? t("sc.selections.rejected") : t("sc.selections.pending")}
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
  const { t } = useLanguage();
  const schedulesQuery = trpc.selectionCenter.getSchedules.useQuery();
  const productsQuery = trpc.selectionCenter.getProducts.useQuery({ page: 1, pageSize: 200 });
  const liversQuery = trpc.selectionCenter.getLivers.useQuery();
  const updateMutation = trpc.selectionCenter.updateSchedule.useMutation({
    onSuccess: () => { schedulesQuery.refetch(); toast.success(t("sc.schedules.updated")); },
  });
  const createMutation = trpc.selectionCenter.createSchedule.useMutation({
    onSuccess: () => { schedulesQuery.refetch(); toast.success(t("sc.schedules.created")); setShowCreateDialog(false); resetForm(); },
  });
  const deleteMutation = trpc.selectionCenter.deleteSchedule.useMutation({
    onSuccess: () => { schedulesQuery.refetch(); toast.success(t("sc.schedules.updated")); },
  });

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formAnchorId, setFormAnchorId] = useState<string>("");
  const [formProductId, setFormProductId] = useState<string>("");
  const [formLiveDate, setFormLiveDate] = useState<string>("");
  const [formStartTime, setFormStartTime] = useState<string>("");
  const [formEndTime, setFormEndTime] = useState<string>("");
  const [formSlotOrder, setFormSlotOrder] = useState<string>("");

  // Inline time edit state
  const [editingTimeId, setEditingTimeId] = useState<number | null>(null);
  const [editStartTime, setEditStartTime] = useState<string>("");
  const [editEndTime, setEditEndTime] = useState<string>("");

  // Batch generation state
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [batchLiverId, setBatchLiverId] = useState<string>("");
  const [batchLiveDate, setBatchLiveDate] = useState<string>("");
  const [batchStartTime, setBatchStartTime] = useState<string>("");
  const [batchEndTime, setBatchEndTime] = useState<string>("");
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);

  const liverProductsQuery = trpc.selectionCenter.getLiverProductsByBrand.useQuery(
    { liverId: Number(batchLiverId) },
    { enabled: !!batchLiverId }
  );
  const batchMutation = trpc.selectionCenter.batchCreateSchedules.useMutation({
    onSuccess: (data) => {
      schedulesQuery.refetch();
      toast.success(t("sc.schedules.batchSuccess").replace("{count}", String(data.count)));
      setShowBatchDialog(false);
      resetBatchForm();
    },
    onError: (err) => { toast.error(t("sc.schedules.batchError") + ": " + err.message); },
  });

  const resetBatchForm = () => {
    setBatchLiverId(""); setBatchLiveDate(""); setBatchStartTime(""); setBatchEndTime(""); setSelectedProductIds([]);
  };

  // When liver changes, auto-select all products
  useEffect(() => {
    if (liverProductsQuery.data && liverProductsQuery.data.length > 0) {
      const allIds = liverProductsQuery.data.flatMap((g: any) => g.products.map((p: any) => p.id));
      setSelectedProductIds(allIds);
    } else {
      setSelectedProductIds([]);
    }
  }, [liverProductsQuery.data]);

  const handleBatchGenerate = () => {
    if (!batchLiverId || !batchLiveDate) {
      toast.error(t("sc.schedules.validationError")); return;
    }
    if (selectedProductIds.length === 0) {
      toast.error(t("sc.schedules.noProducts")); return;
    }
    batchMutation.mutate({
      anchorId: Number(batchLiverId),
      liveDate: batchLiveDate,
      startTime: batchStartTime || undefined,
      endTime: batchEndTime || undefined,
      productIds: selectedProductIds,
    });
  };

  const toggleProductSelection = (productId: number) => {
    setSelectedProductIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const allProductIds = useMemo(() => {
    if (!liverProductsQuery.data) return [];
    return liverProductsQuery.data.flatMap((g: any) => g.products.map((p: any) => p.id));
  }, [liverProductsQuery.data]);

  const toggleAll = () => {
    if (selectedProductIds.length === allProductIds.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(allProductIds);
    }
  };

  // Filters
  const [filterLiver, setFilterLiver] = useState<string>("all");
  const [filterBrand, setFilterBrand] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");

  const resetForm = () => {
    setFormAnchorId(""); setFormProductId(""); setFormLiveDate(""); setFormStartTime(""); setFormEndTime(""); setFormSlotOrder("");
  };

  const handleCreate = () => {
    if (!formAnchorId || !formProductId || !formLiveDate) {
      toast.error(t("sc.schedules.validationError")); return;
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

  const getLiverName = (anchorId: number) => {
    const liver = liversQuery.data?.find((l: any) => l.id === anchorId);
    return liver?.name || `ID: ${anchorId}`;
  };

  // Get unique brands from schedules data
  const uniqueBrands = useMemo(() => {
    if (!schedulesQuery.data) return [];
    const brands = new Set<string>();
    schedulesQuery.data.forEach((s: any) => {
      if (s.product?.brandName) brands.add(s.product.brandName);
    });
    return Array.from(brands).sort();
  }, [schedulesQuery.data]);

  // Filter and group schedules by liver
  const groupedByLiver = useMemo(() => {
    if (!schedulesQuery.data) return {};
    let filtered = schedulesQuery.data.filter((s: any) => s.status !== 'cancelled');

    // Apply filters
    if (filterLiver !== "all") {
      filtered = filtered.filter((s: any) => String(s.anchorId) === filterLiver);
    }
    if (filterBrand !== "all") {
      filtered = filtered.filter((s: any) => s.product?.brandName === filterBrand);
    }
    if (filterDate) {
      filtered = filtered.filter((s: any) => {
        const rawDate = s.liveDate instanceof Date ? s.liveDate.toISOString() : String(s.liveDate || '');
        return rawDate.split('T')[0] === filterDate;
      });
    }

    // Group by liver
    const groups: Record<string, { liverName: string; items: any[] }> = {};
    filtered.forEach((s: any) => {
      const key = String(s.anchorId);
      if (!groups[key]) {
        groups[key] = { liverName: getLiverName(s.anchorId), items: [] };
      }
      groups[key].items.push(s);
    });

    // Sort items within each group by date then slotOrder
    Object.values(groups).forEach(g => {
      g.items.sort((a: any, b: any) => {
        const dateA = (a.liveDate instanceof Date ? a.liveDate.toISOString() : String(a.liveDate || '')).split('T')[0];
        const dateB = (b.liveDate instanceof Date ? b.liveDate.toISOString() : String(b.liveDate || '')).split('T')[0];
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (a.slotOrder || 99) - (b.slotOrder || 99);
      });
    });

    return groups;
  }, [schedulesQuery.data, filterLiver, filterBrand, filterDate, liversQuery.data]);

  // Stats
  const totalSchedules = schedulesQuery.data?.filter((s: any) => s.status !== 'cancelled').length || 0;
  const confirmedCount = schedulesQuery.data?.filter((s: any) => s.status === 'confirmed').length || 0;
  const pendingCount = schedulesQuery.data?.filter((s: any) => s.status === 'pending').length || 0;

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-3">
          <div className="text-xs text-muted-foreground">{t("sc.schedules.totalSchedules")}</div>
          <div className="text-xl font-bold">{totalSchedules}</div>
        </div>
        <div className="border rounded-lg p-3">
          <div className="text-xs text-muted-foreground">{t("sc.schedules.confirmed")}</div>
          <div className="text-xl font-bold text-green-600">{confirmedCount}</div>
        </div>
        <div className="border rounded-lg p-3">
          <div className="text-xs text-muted-foreground">{t("sc.schedules.pending")}</div>
          <div className="text-xl font-bold text-orange-500">{pendingCount}</div>
        </div>
      </div>

      {/* Toolbar: filters + add button */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterLiver} onValueChange={setFilterLiver}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t("sc.schedules.liverCol")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("sc.schedules.allLivers")}</SelectItem>
            {liversQuery.data?.map((liver: any) => (
              <SelectItem key={liver.id} value={String(liver.id)}>{liver.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterBrand} onValueChange={setFilterBrand}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t("sc.schedules.brandCol")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("sc.schedules.allBrands")}</SelectItem>
            {uniqueBrands.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="w-[160px]"
        />
        {filterDate && (
          <Button variant="ghost" size="sm" onClick={() => setFilterDate("")}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Dialog open={showBatchDialog} onOpenChange={(open) => { setShowBatchDialog(open); if (!open) resetBatchForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="default" className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white">
                <Zap className="h-4 w-4 mr-1" />{t("sc.schedules.batchGenerate")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("sc.schedules.batchTitle")}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">{t("sc.schedules.batchDesc")}</p>
              </DialogHeader>
              <div className="space-y-4">
                {/* Liver selector */}
                <div>
                  <Label>{t("sc.schedules.liver")}</Label>
                  <Select value={batchLiverId} onValueChange={(v) => { setBatchLiverId(v); setSelectedProductIds([]); }}>
                    <SelectTrigger><SelectValue placeholder={t("sc.schedules.selectLiver")} /></SelectTrigger>
                    <SelectContent>
                      {liversQuery.data?.map((liver: any) => (
                        <SelectItem key={liver.id} value={String(liver.id)}>{liver.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Date and time */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>{t("sc.schedules.liveDate")} *</Label>
                    <Input type="date" value={batchLiveDate} onChange={(e) => setBatchLiveDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t("sc.schedules.startTime")}</Label>
                    <Input type="time" value={batchStartTime} onChange={(e) => setBatchStartTime(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t("sc.schedules.endTime")}</Label>
                    <Input type="time" value={batchEndTime} onChange={(e) => setBatchEndTime(e.target.value)} />
                  </div>
                </div>
                {/* Products preview */}
                {batchLiverId && (
                  <div className="border rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">{t("sc.schedules.productsPreview")}</h4>
                      <div className="flex items-center gap-2">
                        {allProductIds.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {t("sc.schedules.totalProducts").replace("{count}", String(allProductIds.length))}
                            {" ("}{selectedProductIds.length}/{allProductIds.length}{" selected)"}
                          </span>
                        )}
                        <Button size="sm" variant="ghost" onClick={toggleAll}>
                          {selectedProductIds.length === allProductIds.length ? t("sc.schedules.deselectAll") : t("sc.schedules.selectAll")}
                        </Button>
                      </div>
                    </div>
                    {liverProductsQuery.isLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : liverProductsQuery.data && liverProductsQuery.data.length > 0 ? (
                      <div className="space-y-3">
                        {liverProductsQuery.data.map((group: any) => (
                          <div key={group.brand} className="border rounded p-2">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="secondary" className="font-medium">{group.brand}</Badge>
                              <span className="text-xs text-muted-foreground">{group.products.length} items</span>
                            </div>
                            <div className="space-y-1">
                              {group.products.map((product: any) => (
                                <label key={product.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer">
                                  <Checkbox
                                    checked={selectedProductIds.includes(product.id)}
                                    onCheckedChange={() => toggleProductSelection(product.id)}
                                  />
                                  <span className="text-sm flex-1">{product.productName}</span>
                                  {product.price && <span className="text-xs text-muted-foreground">¥{product.price}</span>}
                                  {product.commissionValue && (
                                    <span className="text-xs text-orange-600">
                                      {product.commissionType === 'percentage' ? `${product.commissionValue}%` : `¥${product.commissionValue}`}
                                    </span>
                                  )}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">{t("sc.schedules.noProducts")}</p>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowBatchDialog(false); resetBatchForm(); }}>{t("sc.schedules.cancel")}</Button>
                <Button
                  onClick={handleBatchGenerate}
                  disabled={batchMutation.isPending || !batchLiverId || !batchLiveDate || selectedProductIds.length === 0}
                  className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                >
                  {batchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                  {batchMutation.isPending ? t("sc.schedules.generating") : `${t("sc.schedules.generateBtn")} (${selectedProductIds.length})`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />{t("sc.schedules.add")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{t("sc.schedules.addTitle")}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t("sc.schedules.liver")}</Label>
                  <Select value={formAnchorId} onValueChange={setFormAnchorId}>
                    <SelectTrigger><SelectValue placeholder={t("sc.schedules.selectLiver")} /></SelectTrigger>
                    <SelectContent>
                      {liversQuery.data?.map((liver: any) => (
                        <SelectItem key={liver.id} value={String(liver.id)}>{liver.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("sc.schedules.product")}</Label>
                  <Select value={formProductId} onValueChange={setFormProductId}>
                    <SelectTrigger><SelectValue placeholder={t("sc.schedules.selectProduct")} /></SelectTrigger>
                    <SelectContent>
                      {productsQuery.data?.items?.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.productName} {p.brandName ? `(${p.brandName})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("sc.schedules.streamDate")}</Label>
                  <Input type="date" value={formLiveDate} onChange={(e) => setFormLiveDate(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t("sc.schedules.startTime")}</Label>
                    <Input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t("sc.schedules.endTime")}</Label>
                    <Input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>{t("sc.schedules.order")}</Label>
                  <Input type="number" placeholder="1, 2, 3..." value={formSlotOrder} onChange={(e) => setFormSlotOrder(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{t("sc.schedules.cancel")}</Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  {t("sc.schedules.create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main table grouped by liver */}
      {Object.keys(groupedByLiver).length > 0 ? (
        Object.entries(groupedByLiver).sort(([, a], [, b]) => a.liverName.localeCompare(b.liverName)).map(([anchorId, group]) => (
          <div key={anchorId} className="border rounded-lg overflow-hidden">
            <div className="bg-blue-50 dark:bg-blue-950/30 px-4 py-2.5 font-semibold flex items-center gap-2 border-b">
              <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 text-xs font-bold">
                {group.liverName.charAt(0)}
              </div>
              {group.liverName}
              <Badge variant="outline" className="ml-auto">{group.items.length}{t("sc.schedules.items")}</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left p-3 font-medium w-[110px]">{t("sc.schedules.streamDate")}</th>
                    <th className="text-center p-3 font-medium w-[120px]">{t("sc.schedules.timeSlot")}</th>
                    <th className="text-left p-3 font-medium">{t("sc.schedules.brandCol")}</th>
                    <th className="text-left p-3 font-medium">{t("sc.schedules.productCol")}</th>
                    <th className="text-center p-3 font-medium w-[60px]">{t("sc.schedules.orderCol")}</th>
                    <th className="text-center p-3 font-medium w-[80px]">{t("sc.status")}</th>
                    <th className="text-center p-3 font-medium w-[100px]">{t("sc.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((schedule: any, idx: number) => {
                    const rawDate = schedule.liveDate instanceof Date ? schedule.liveDate.toISOString() : String(schedule.liveDate || '');
                    const dateStr = rawDate.split('T')[0];
                    const prevDate = idx > 0 ? ((group.items[idx-1].liveDate instanceof Date ? group.items[idx-1].liveDate.toISOString() : String(group.items[idx-1].liveDate || '')).split('T')[0]) : null;
                    const showDateDivider = idx === 0 || dateStr !== prevDate;

                    return (
                      <tr key={schedule.id} className={`border-t hover:bg-muted/30 ${showDateDivider && idx > 0 ? 'border-t-2 border-t-blue-200 dark:border-t-blue-800' : ''}`}>
                        <td className="p-3 text-sm">
                          {showDateDivider ? (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              {dateStr}
                            </span>
                          ) : null}
                        </td>
                        <td className="p-3 text-center text-sm">
                          {editingTimeId === schedule.id ? (
                            <div className="flex items-center gap-1">
                              <input type="time" className="w-[75px] text-xs border rounded px-1 py-0.5 bg-background" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} />
                              <span>~</span>
                              <input type="time" className="w-[75px] text-xs border rounded px-1 py-0.5 bg-background" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} />
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { updateMutation.mutate({ id: schedule.id, startTime: editStartTime || undefined, endTime: editEndTime || undefined }); setEditingTimeId(null); }}>
                                <Check className="h-3 w-3 text-green-600" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingTimeId(null)}>
                                <X className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </div>
                          ) : (
                            <span className="cursor-pointer hover:text-primary hover:underline" onClick={() => { setEditingTimeId(schedule.id); setEditStartTime(schedule.startTime || ""); setEditEndTime(schedule.endTime || ""); }}>
                              {schedule.startTime || "-"} ~ {schedule.endTime || "-"}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {schedule.product?.brandName ? (
                            <Badge variant="secondary" className="font-medium">{schedule.product.brandName}</Badge>
                          ) : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="p-3 font-medium">{schedule.product?.productName || "-"}</td>
                        <td className="p-3 text-center">{schedule.slotOrder || "-"}</td>
                        <td className="p-3 text-center">
                          <Badge variant={schedule.status === "confirmed" ? "default" : schedule.status === "done" ? "secondary" : "outline"}
                            className={schedule.status === "confirmed" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : schedule.status === "done" ? "bg-gray-100 text-gray-800" : ""}
                          >
                            {schedule.status === "pending" ? t("sc.schedules.pending") : schedule.status === "confirmed" ? t("sc.schedules.confirmed") : schedule.status === "done" ? t("sc.schedules.done") : t("sc.schedules.cancelled")}
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
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {(schedule.status === "pending" || schedule.status === "confirmed") && (
                            <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ id: schedule.id, status: "cancelled" })}>
                              <X className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => { if (confirm(t("sc.schedules.confirmDelete") || '确定要删除这条排期吗？')) deleteMutation.mutate({ id: schedule.id }); }}>
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      ) : (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          {t("sc.schedules.noData")}
        </div>
      )}
    </div>
  );
}

// ==================== Performances Tab ====================
function PerformancesTab() {
  const { t } = useLanguage();
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
        <h3 className="text-lg font-semibold">{t("sc.perf.title")}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("sc.perf.streamer")}</span>
          <Select value={selectedStreamer} onValueChange={(v) => { setSelectedStreamer(v); setExpandedProduct(null); setExpandedLivestream(null); }}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder={t("sc.perf.allStreamers")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("sc.perf.allStreamersCount").replace("{count}", String(streamerNames.reduce((s: number, n: any) => s + n.count, 0)))}</SelectItem>
              {streamerNames.map((s) => (
                <SelectItem key={s.name} value={s.name}>{s.name}{t("sc.perf.streamerCount").replace("{count}", String(s.count))}</SelectItem>
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
          <BarChart3 className="h-4 w-4 mr-1" />{t("sc.perf.productPerf")}
        </Button>
        <Button 
          variant={activeSubTab === "daily" ? "default" : "ghost"} 
          size="sm"
          onClick={() => setActiveSubTab("daily")}
        >
          <Calendar className="h-4 w-4 mr-1" />{t("sc.perf.dailyView")}
        </Button>
        <Button 
          variant={activeSubTab === "imports" ? "default" : "ghost"} 
          size="sm"
          onClick={() => setActiveSubTab("imports")}
        >
          <ClipboardList className="h-4 w-4 mr-1" />{t("sc.perf.importHistory")}
        </Button>
      </div>

      {activeSubTab === "products" && (
        <>
          {/* Search + Sort */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={t("sc.perf.searchProduct")} 
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
                {t("sc.perf.potential")}
              </Button>
              <Button
                variant={sortMode === 'gmv' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortMode('gmv')}
                className="text-xs"
              >
                {t("sc.perf.gmvOrder")}
              </Button>
              <Button
                variant={sortMode === 'impressions' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortMode('impressions')}
                className="text-xs"
              >
                {t("sc.perf.impressionOrder")}
              </Button>
            </div>
          </div>

          {/* Summary cards */}
          {products.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{t("sc.perf.totalProductCount")}</p>
                  <p className="text-xl font-bold">{products.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{t("sc.totalGmv")}</p>
                  <p className="text-xl font-bold text-yellow-500">¥{products.reduce((s, p) => s + p.totalGmv, 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{t("sc.perf.totalSales")}</p>
                  <p className="text-xl font-bold">{products.reduce((s, p) => s + p.totalItemsSold, 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{t("sc.perf.totalImpressions")}</p>
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
                            {t("sc.perf.liveRecommend")}
                          </Badge>
                        )}
                        {(product as any).impressionSpike && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                            {t("sc.perf.impressionSurge")}
                          </Badge>
                        )}
                        {(product as any).clickSpike && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 shrink-0 bg-orange-500">
                            {t("sc.perf.clickSurge")}
                          </Badge>
                        )}
                        {(product as any).highImpLowSales && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 border-yellow-500 text-yellow-500">
                            {t("sc.perf.highImpLowSales")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("sc.perf.streamCount").replace("{count}", String(product.livestreamCount))} ・ {t("sc.perf.avgPrice")} ¥{product.totalItemsSold > 0 ? Math.round(product.totalGmv / product.totalItemsSold).toLocaleString() : '0'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-right text-xs">
                      <div>
                        <p className="text-muted-foreground">GMV</p>
                        <p className="font-semibold text-yellow-500">¥{product.totalGmv.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("sc.perf.salesCount")}</p>
                        <p className="font-semibold">{product.totalItemsSold.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("sc.perf.impressions")}</p>
                        <p className="font-semibold">{product.totalImpressions.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("sc.perf.clicks")}</p>
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
                              <th className="text-left p-2 font-medium">{t("sc.perf.streamDate")}</th>
                              <th className="text-left p-2 font-medium">{t("sc.perf.liverCol")}</th>
                              <th className="text-right p-2 font-medium">{t("sc.perf.unitPrice")}</th>
                              <th className="text-right p-2 font-medium">{t("sc.perf.gmv")}</th>
                              <th className="text-right p-2 font-medium">{t("sc.perf.salesCountCol")}</th>
                              <th className="text-right p-2 font-medium">{t("sc.perf.impressionsCol")}</th>
                              <th className="text-right p-2 font-medium">{t("sc.perf.clicksCol")}</th>
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
                {performanceQuery.isLoading ? t("sc.perf.loading") : t("sc.perf.noData")}
              </div>
            )}
          </div>
        </>
      )}

      {activeSubTab === "daily" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("sc.perf.dailyDesc")}</p>
          
          {/* Daily summary cards */}
          {dailyData.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{t("sc.perf.streamCountStat")}</p>
                  <p className="text-xl font-bold">{dailyData.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{t("sc.perf.totalGmvStat")}</p>
                  <p className="text-xl font-bold text-yellow-500">¥{dailyData.reduce((s, d) => s + d.totalGmv, 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{t("sc.perf.totalImpStat")}</p>
                  <p className="text-xl font-bold">{dailyData.reduce((s, d) => s + d.totalImpressions, 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{t("sc.perf.avgProductsPerStream")}</p>
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
                          {day.streamerName || t("sc.perf.unknown")}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {day.productCount}{t("sc.perf.productsCount").replace("{count}", "")}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right text-xs">
                      <div>
                        <p className="text-muted-foreground">GMV</p>
                        <p className="font-semibold text-yellow-500">¥{day.totalGmv.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("sc.perf.salesCount")}</p>
                        <p className="font-semibold">{day.totalItems.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("sc.perf.impressions")}</p>
                        <p className="font-semibold">{day.totalImpressions.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("sc.perf.clicks")}</p>
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
                              <th className="text-left p-2 font-medium">{t("sc.perf.productNameCol")}</th>
                              <th className="text-right p-2 font-medium">{t("sc.perf.unitPriceCol")}</th>
                              <th className="text-right p-2 font-medium">GMV</th>
                              <th className="text-right p-2 font-medium">{t("sc.perf.salesCountCol")}</th>
                              <th className="text-right p-2 font-medium">{t("sc.perf.impressionsCol")}</th>
                              <th className="text-right p-2 font-medium">{t("sc.perf.clicksCol")}</th>
                              <th className="text-right p-2 font-medium">CTR</th>
                              <th className="text-right p-2 font-medium">CTOR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dailyProductsQuery.isLoading ? (
                              <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">{t("sc.perf.loading")}</td></tr>
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
                              <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">{t("sc.perf.noData")}</td></tr>
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
                {dailyViewQuery.isLoading ? t("sc.perf.loading") : t("sc.perf.noData")}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === "imports" && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("sc.perf.importHistory")}</p>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">{t("sc.perf.productNameCol")}</th>
                  <th className="text-left p-3 font-medium">{t("sc.perf.importDate")}</th>
                  <th className="text-left p-3 font-medium">{t("sc.perf.importLiver")}</th>
                  <th className="text-right p-3 font-medium">{t("sc.perf.importProductCount")}</th>
                  <th className="text-right p-3 font-medium">GMV</th>
                  <th className="text-left p-3 font-medium">{t("sc.perf.importedBy")}</th>
                  <th className="text-left p-3 font-medium">{t("sc.perf.importDateTime")}</th>
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
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">{t("sc.perf.noImportHistory")}</td></tr>
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
  const { t } = useLanguage();
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({ anchorId: "", periodStart: "", periodEnd: "" });

  const settlementsQuery = trpc.selectionCenter.getSettlements.useQuery();
  const generateMutation = trpc.selectionCenter.generateSettlement.useMutation({
    onSuccess: (data) => {
      settlementsQuery.refetch();
      setShowGenerate(false);
      toast.success(t("sc.settle.generated").replace("{gmv}", Number(data.totalGmv).toLocaleString()).replace("{commission}", Number(data.totalCommission).toLocaleString()));
    },
  });
  const statusMutation = trpc.selectionCenter.updateSettlementStatus.useMutation({
    onSuccess: () => { settlementsQuery.refetch(); toast.success(t("sc.statusUpdated")); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t("sc.settle.title")}</h3>
        <Button onClick={() => setShowGenerate(true)}><Plus className="h-4 w-4 mr-1" />{t("sc.settle.generate")}</Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">{t("sc.settle.liverId")}</th>
              <th className="text-left p-3 font-medium">{t("sc.settle.period")}</th>
              <th className="text-right p-3 font-medium">{t("sc.settle.totalGmv")}</th>
              <th className="text-right p-3 font-medium">{t("sc.settle.totalCommission")}</th>
              <th className="text-center p-3 font-medium">{t("sc.status")}</th>
              <th className="text-center p-3 font-medium">{t("sc.actions")}</th>
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
                    {s.status === "pending" ? t("sc.settle.pending") : s.status === "confirmed" ? t("sc.settle.confirmed") : t("sc.settle.paid")}
                  </Badge>
                </td>
                <td className="p-3 text-center">
                  {s.status === "pending" && (
                    <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate({ id: s.id, status: "confirmed" })}>{t("sc.settle.confirm")}</Button>
                  )}
                  {s.status === "confirmed" && (
                    <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate({ id: s.id, status: "paid" })}>{t("sc.settle.markPaid")}</Button>
                  )}
                </td>
              </tr>
            ))}
            {(!settlementsQuery.data || settlementsQuery.data.length === 0) && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">{t("sc.settle.noData")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("sc.settle.generateTitle")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t("sc.settle.liverId")}</Label><Input type="number" value={genForm.anchorId} onChange={e => setGenForm({ ...genForm, anchorId: e.target.value })} /></div>
            <div><Label>{t("sc.settle.startDate")}</Label><Input type="date" value={genForm.periodStart} onChange={e => setGenForm({ ...genForm, periodStart: e.target.value })} /></div>
            <div><Label>{t("sc.settle.endDate")}</Label><Input type="date" value={genForm.periodEnd} onChange={e => setGenForm({ ...genForm, periodEnd: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>{t("sc.settle.cancel")}</Button>
            <Button onClick={() => generateMutation.mutate({ liverId: Number(genForm.anchorId), periodStart: genForm.periodStart, periodEnd: genForm.periodEnd })} disabled={generateMutation.isPending || !genForm.anchorId || !genForm.periodStart || !genForm.periodEnd}>
              {generateMutation.isPending ? t("sc.settle.generating") : t("sc.settle.generateBtn")}
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
          <span className="text-sm font-semibold text-blue-900">{t("sc.brand.historyData")}</span>
          <Badge variant="outline" className="text-[10px]">{brandName}</Badge>
        </div>
        <span className="text-xs text-muted-foreground">{expanded ? t("sc.brand.collapse") : t("sc.brand.expand")}</span>
      </button>
      {expanded && (
        <div className="p-3 space-y-3">
          {perfQuery.isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="ml-2 text-sm text-muted-foreground">{t("sc.brand.loading")}</span>
            </div>
          )}
          {perfQuery.data && !perfQuery.data.found && (
            <p className="text-sm text-muted-foreground text-center py-3">{t("sc.brand.noData")}</p>
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
                  <p className="text-[10px] text-muted-foreground">{t("sc.brand.impressions")}</p>
                  <p className="text-sm font-bold text-blue-600">{perfQuery.data.summary.totalImpressions.toLocaleString()}</p>
                </div>
                <div className="bg-green-50 rounded p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">CTR</p>
                  <p className="text-sm font-bold text-green-600">{perfQuery.data.summary.avgCtr}%</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-purple-50 rounded p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">{t("sc.brand.salesCount")}</p>
                  <p className="text-sm font-bold text-purple-600">{perfQuery.data.summary.totalSales.toLocaleString()}</p>
                </div>
                <div className="bg-pink-50 rounded p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">{t("sc.brand.clicks")}</p>
                  <p className="text-sm font-bold text-pink-600">{perfQuery.data.summary.totalClicks.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">{t("sc.brand.streamCount")}</p>
                  <p className="text-sm font-bold">{perfQuery.data.summary.totalStreams}</p>
                </div>
              </div>
              {/* Top products */}
              {perfQuery.data.products.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-muted-foreground mb-1">{t("sc.brand.topProducts").replace("{count}", String(Math.min(perfQuery.data.products.length, 10)))}</h5>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {perfQuery.data.products.slice(0, 10).map((p: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted/50">
                        <span className="truncate flex-1 mr-2">{p.productName}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-orange-600 font-medium">¥{p.totalGmv.toLocaleString()}</span>
                          <span className="text-muted-foreground">{p.streamCount}{t("sc.brand.times").replace("{count}", "")}</span>
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
  const { t } = useLanguage();
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
          {t("sc.title")}
        </h1>
        <a href="/barcode-scanner" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">
            <ScanBarcode className="h-4 w-4 mr-1" />
            {t("sc.barcodeSearch")}
          </Button>
        </a>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("sc.totalProducts")}</p>
            <p className="text-2xl font-bold">{d?.totalProducts || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("sc.online")}</p>
            <p className="text-2xl font-bold text-green-600">{d?.onlineProducts || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("sc.selectionCount")}</p>
            <p className="text-2xl font-bold text-blue-600">{d?.totalSelections || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("sc.confirmedSchedules")}</p>
            <p className="text-2xl font-bold text-purple-600">{d?.confirmedSchedules || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("sc.perf.totalGmv")}</p>
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
          <TabsTrigger value="products"><Package className="h-4 w-4 mr-1" />{t("sc.tab.products")}</TabsTrigger>
          <TabsTrigger value="liver-selection"><ShoppingBag className="h-4 w-4 mr-1" />{t("sc.tab.liverSelection")}</TabsTrigger>
          <TabsTrigger value="schedules"><Calendar className="h-4 w-4 mr-1" />{t("sc.tab.schedules")}</TabsTrigger>
          <TabsTrigger value="performances"><TrendingUp className="h-4 w-4 mr-1" />{t("sc.tab.performances")}</TabsTrigger>
          <TabsTrigger value="settlements"><DollarSign className="h-4 w-4 mr-1" />{t("sc.tab.settlements")}</TabsTrigger>
          <TabsTrigger value="selections"><ClipboardList className="h-4 w-4 mr-1" />{t("sc.tab.selections")}</TabsTrigger>
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
