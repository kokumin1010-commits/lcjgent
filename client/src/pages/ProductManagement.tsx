import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Package, ImageIcon, GripVertical, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type ProductStatus = "draft" | "active" | "sold_out" | "archived";

interface ImageItem {
  url: string;
  key: string;
}

interface ProductFormData {
  name: string;
  description: string;
  category: string;
  brandId: number | null;
  categoryId: number | null;
  price: number;
  pointPrice: number | null;
  stock: number;
  images: ImageItem[];
  status: ProductStatus;
  sortOrder: number;
  commissionRate: string;
}

const initialFormData: ProductFormData = {
  name: "",
  description: "",
  category: "",
  brandId: null,
  categoryId: null,
  price: 0,
  pointPrice: null,
  stock: 0,
  images: [],
  status: "draft",
  sortOrder: 0,
  commissionRate: "",
};

// ドラッグ＆ドロップ可能な画像アイテムコンポーネント
function SortableImageItem({
  id,
  img,
  index,
  onRemove,
}: {
  id: string;
  img: ImageItem;
  index: number;
  onRemove: (index: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group rounded-lg border-2 transition-all ${
        isDragging
          ? "border-primary scale-105 shadow-lg"
          : "border-border hover:border-primary/50"
      } ${index === 0 ? "ring-2 ring-primary ring-offset-2" : ""}`}
    >
      {/* ドラッグハンドル（画像全体） */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <div className="aspect-square overflow-hidden rounded-md">
          <img
            src={img.url}
            alt={`商品画像 ${index + 1}`}
            className="w-full h-full object-cover pointer-events-none"
          />
        </div>
      </div>
      {/* メイン画像バッジ */}
      {index === 0 && (
        <div className="absolute top-1 left-1 pointer-events-none">
          <Badge className="text-[10px] px-1 py-0 bg-primary">メイン</Badge>
        </div>
      )}
      {/* ドラッグハンドルアイコン */}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <GripVertical className="h-4 w-4 text-white drop-shadow-md" />
      </div>
      {/* 削除ボタン */}
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

export default function ProductManagement() {
  const { t } = useLanguage();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<number | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(initialFormData);
  const [filterStatus, setFilterStatus] = useState<ProductStatus | "all">("all");
  const [isUploading, setIsUploading] = useState(false);

  const utils = trpc.useUtils();

  const { data: products, isLoading } = trpc.mall.getProducts.useQuery(
    filterStatus === "all" ? undefined : { status: filterStatus }
  );

  // ブランド・カテゴリ一覧を取得
  const { data: brands } = trpc.brand.list.useQuery({});
  const { data: categories } = trpc.mall.getCategoryRecords.useQuery();

  const createProduct = trpc.mall.createProduct.useMutation({
    onSuccess: () => {
      toast.success("商品を登録しました");
      utils.mall.getProducts.invalidate();
      setIsDialogOpen(false);
      setEditingProduct(null);
      setFormData(initialFormData);
    },
    onError: (error) => {
      toast.error(error.message || "商品の登録に失敗しました");
    },
  });

  const updateProduct = trpc.mall.updateProduct.useMutation({
    onSuccess: () => {
      toast.success("商品を更新しました");
      utils.mall.getProducts.invalidate();
      setIsDialogOpen(false);
      setEditingProduct(null);
      setFormData(initialFormData);
    },
    onError: (error) => {
      toast.error(error.message || "商品の更新に失敗しました");
    },
  });

  const deleteProduct = trpc.mall.deleteProduct.useMutation({
    onSuccess: () => {
      toast.success("商品を削除しました");
      utils.mall.getProducts.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "商品の削除に失敗しました");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      name: formData.name,
      description: formData.description || undefined,
      category: formData.category || undefined,
      brandId: formData.brandId,
      categoryId: formData.categoryId,
      price: formData.price,
      pointPrice: formData.pointPrice || undefined,
      stock: formData.stock,
      imageUrl: formData.images[0]?.url || undefined,
      imageKey: formData.images[0]?.key || undefined,
      imageUrls: formData.images.map(i => i.url),
      imageKeys: formData.images.map(i => i.key),
      status: formData.status,
      sortOrder: formData.sortOrder,
      commissionRate: formData.commissionRate || null,
    };

    if (editingProduct) {
      updateProduct.mutate({ id: editingProduct, ...submitData });
    } else {
      createProduct.mutate(submitData);
    }
  };

  const handleEdit = (product: NonNullable<typeof products>[0]) => {
    setEditingProduct(product.id);
    // 複数画像を復元
    const images: ImageItem[] = [];
    if (product.imageUrls && product.imageKeys && product.imageUrls.length > 0) {
      for (let i = 0; i < product.imageUrls.length; i++) {
        images.push({
          url: product.imageUrls[i],
          key: product.imageKeys?.[i] || "",
        });
      }
    } else if (product.imageUrl) {
      images.push({ url: product.imageUrl, key: product.imageKey || "" });
    }

    setFormData({
      name: product.name,
      description: product.description || "",
      category: product.category || "",
      brandId: product.brandId ?? null,
      categoryId: product.categoryId ?? null,
      price: product.price,
      pointPrice: product.pointPrice,
      stock: product.stock,
      images,
      status: product.status as ProductStatus,
      sortOrder: product.sortOrder,
      commissionRate: product.commissionRate || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("この商品を削除しますか？")) {
      deleteProduct.mutate({ id });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const maxFiles = 10;
    const currentCount = formData.images.length;
    const remainingSlots = maxFiles - currentCount;
    
    if (remainingSlots <= 0) {
      toast.error(`画像は最大${maxFiles}枚までです`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      toast.info(`最大${maxFiles}枚まで。${remainingSlots}枚のみアップロードします`);
    }

    setIsUploading(true);
    let uploadedCount = 0;

    for (const file of filesToUpload) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name}: 5MB以下にしてください`);
        continue;
      }

      try {
        // Use REST API with FormData (avoids tRPC base64 size issues)
        const formDataUpload = new FormData();
        formDataUpload.append("file", file);

        const response = await fetch("/api/upload-product-image", {
          method: "POST",
          body: formDataUpload,
          credentials: "include",
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
          throw new Error(errorData.error || `アップロード失敗 (${response.status})`);
        }

        const result = await response.json();

        setFormData(prev => ({
          ...prev,
          images: [...prev.images, { url: result.url, key: result.key }],
        }));
        uploadedCount++;
      } catch (error: any) {
        const errorMsg = error?.message || '不明なエラー';
        console.error(`[Upload] Failed for ${file.name}:`, error);
        toast.error(`${file.name}: アップロード失敗 - ${errorMsg}`);
      }
    }

    if (uploadedCount > 0) {
      toast.success(`${uploadedCount}枚の画像をアップロードしました`);
    }
    setIsUploading(false);
    // inputをリセット
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  // @dnd-kit sensors（タッチ・ポインター・キーボード対応）
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setFormData(prev => {
      const oldIndex = prev.images.findIndex((_, i) => `img-${i}` === active.id);
      const newIndex = prev.images.findIndex((_, i) => `img-${i}` === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return { ...prev, images: arrayMove(prev.images, oldIndex, newIndex) };
    });
  }, []);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      draft: { variant: "secondary", label: "下書き" },
      active: { variant: "default", label: "販売中" },
      sold_out: { variant: "destructive", label: "売り切れ" },
      archived: { variant: "outline", label: "アーカイブ" },
    };
    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // ブランド名を取得するヘルパー
  const getBrandName = (brandId: number | null) => {
    if (!brandId || !brands) return "-";
    const brand = brands.find((b) => b.id === brandId);
    return brand ? brand.name : "-";
  };

  // カテゴリ名を取得するヘルパー
  const getCategoryName = (categoryId: number | null, legacyCategory: string | null) => {
    if (categoryId && categories) {
      const cat = categories.find((c) => c.id === categoryId);
      if (cat) return cat.iconEmoji ? `${cat.iconEmoji} ${cat.name}` : cat.name;
    }
    return legacyCategory || "-";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">商品管理</h1>
            <p className="text-muted-foreground">LCJ MALLの商品を管理します</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingProduct(null);
              setFormData(initialFormData);
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                商品を追加
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? "商品を編集" : "新規商品登録"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-sm font-medium">商品名 *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="商品名を入力"
                      required
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-sm font-medium">商品説明</label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="商品の説明を入力"
                      rows={3}
                    />
                  </div>

                  {/* ブランド選択ドロップダウン */}
                  <div>
                    <label className="text-sm font-medium">ブランド</label>
                    <Select
                      value={formData.brandId ? String(formData.brandId) : "none"}
                      onValueChange={(v) => setFormData({ ...formData, brandId: v === "none" ? null : Number(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="ブランドを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">未設定</SelectItem>
                        {brands?.map((brand) => (
                          <SelectItem key={brand.id} value={String(brand.id)}>
                            {brand.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* カテゴリ選択ドロップダウン */}
                  <div>
                    <label className="text-sm font-medium">カテゴリ</label>
                    <Select
                      value={formData.categoryId ? String(formData.categoryId) : "none"}
                      onValueChange={(v) => setFormData({ ...formData, categoryId: v === "none" ? null : Number(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="カテゴリを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">未設定</SelectItem>
                        {categories?.filter(c => c.isActive === "yes").map((cat) => (
                          <SelectItem key={cat.id} value={String(cat.id)}>
                            {cat.iconEmoji ? `${cat.iconEmoji} ` : ""}{cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">ステータス</label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: ProductStatus) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">下書き</SelectItem>
                        <SelectItem value="active">販売中</SelectItem>
                        <SelectItem value="sold_out">売り切れ</SelectItem>
                        <SelectItem value="archived">アーカイブ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">価格（円） *</label>
                    <Input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      placeholder="0"
                      min={0}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">ポイント価格（任意）</label>
                    <Input
                      type="number"
                      value={formData.pointPrice || ""}
                      onChange={(e) => setFormData({ ...formData, pointPrice: e.target.value ? Number(e.target.value) : null })}
                      placeholder="ポイントで購入可能な場合"
                      min={0}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">在庫数</label>
                    <Input
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                      placeholder="0"
                      min={0}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">表示順</label>
                    <Input
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">成果報酬（%）</label>
                    <Input
                      type="number"
                      value={formData.commissionRate}
                      onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                      placeholder="例: 10.00"
                      min={0}
                      max={100}
                      step="0.01"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      TikTokでこの商品が売れた際の成果報酬率
                    </p>
                  </div>

                  {/* 複数画像アップロード */}
                  <div className="col-span-2">
                    <label className="text-sm font-medium">
                      商品画像（最大10枚・ドラッグで並び替え可能）
                    </label>
                    <div className="mt-2 space-y-3">
                      {/* 画像プレビューグリッド（ドラッグ＆ドロップ並び替え対応） */}
                      {formData.images.length > 0 && (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEnd}
                        >
                          <SortableContext
                            items={formData.images.map((_, i) => `img-${i}`)}
                            strategy={rectSortingStrategy}
                          >
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                              {formData.images.map((img, index) => (
                                <SortableImageItem
                                  key={`${img.url}-${index}`}
                                  id={`img-${index}`}
                                  img={img}
                                  index={index}
                                  onRemove={removeImage}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      )}
                      
                      {/* アップロードエリア */}
                      {formData.images.length < 10 && (
                        <label className="cursor-pointer block">
                          <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                            isUploading ? "bg-muted" : "hover:bg-muted/50 hover:border-primary"
                          }`}>
                            {isUploading ? (
                              <div className="flex items-center justify-center gap-2">
                                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                                <span className="text-sm text-muted-foreground">アップロード中...</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                  クリックして画像を選択（複数選択可）
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  PNG, JPG, GIF（各5MB以下）・残り{10 - formData.images.length}枚
                                </span>
                              </div>
                            )}
                          </div>
                          <Input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageUpload}
                            disabled={isUploading}
                            className="hidden"
                          />
                        </label>
                      )}

                      {/* URL直接入力 */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">URL追加:</span>
                        <Input
                          placeholder="画像URLを入力してEnter"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const url = (e.target as HTMLInputElement).value.trim();
                              if (url && formData.images.length < 10) {
                                setFormData(prev => ({
                                  ...prev,
                                  images: [...prev.images, { url, key: "" }],
                                }));
                                (e.target as HTMLInputElement).value = "";
                              }
                            }
                          }}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    キャンセル
                  </Button>
                  <Button
                    type="submit"
                    disabled={createProduct.isPending || updateProduct.isPending}
                  >
                    {editingProduct ? "更新" : "登録"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* フィルター */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">ステータス:</label>
              <Select
                value={filterStatus}
                onValueChange={(value) => setFilterStatus(value as ProductStatus | "all")}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="draft">下書き</SelectItem>
                  <SelectItem value="active">販売中</SelectItem>
                  <SelectItem value="sold_out">売り切れ</SelectItem>
                  <SelectItem value="archived">アーカイブ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 商品一覧 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              商品一覧
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                読み込み中...
              </div>
            ) : !products || products.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                商品がありません
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">画像</TableHead>
                    <TableHead>商品名</TableHead>
                    <TableHead>ブランド</TableHead>
                    <TableHead>カテゴリ</TableHead>
                    <TableHead className="text-right">価格</TableHead>
                    <TableHead className="text-right">ポイント価格</TableHead>
                    <TableHead className="text-right">在庫</TableHead>
                    <TableHead className="text-right">成果報酬</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const imageCount = product.imageUrls?.length || (product.imageUrl ? 1 : 0);
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="relative">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="h-12 w-12 object-cover rounded"
                              />
                            ) : (
                              <div className="h-12 w-12 bg-muted rounded flex items-center justify-center">
                                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            {imageCount > 1 && (
                              <Badge className="absolute -top-1 -right-1 text-[10px] px-1 py-0 min-w-[18px] h-[18px] flex items-center justify-center">
                                {imageCount}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {getBrandName(product.brandId)}
                        </TableCell>
                        <TableCell>
                          {getCategoryName(product.categoryId, product.category)}
                        </TableCell>
                        <TableCell className="text-right">
                          ¥{product.price.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.pointPrice ? `${product.pointPrice.toLocaleString()}pt` : "-"}
                        </TableCell>
                        <TableCell className="text-right">{product.stock}</TableCell>
                        <TableCell className="text-right">
                          {product.commissionRate ? `${product.commissionRate}%` : "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(product.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(product)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(product.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
