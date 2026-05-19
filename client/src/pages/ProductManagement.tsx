import { useState, useMemo, useCallback } from "react";
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
import { Plus, Pencil, Trash2, Package, ImageIcon, GripVertical, X, Search, FileImage, Upload } from "lucide-react";
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
  subcategoryId: number | null;
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
  subcategoryId: null,
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
      {/* ドラッグハンドル（画像/動画全体） */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <div className="aspect-square overflow-hidden rounded-md">
          {/\.(mp4|webm|mov|avi|m4v)$/i.test(img.url) ? (
            <video
              src={img.url}
              className="w-full h-full object-cover pointer-events-none"
              muted
              playsInline
            />
          ) : (
            <img
              src={img.url}
              alt={`商品メディア ${index + 1}`}
              className="w-full h-full object-cover pointer-events-none"
            />
          )}
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

// 商品説明画像管理セクション（図文モード）
function DescImageSection({ productId }: { productId: number }) {
  const utils = trpc.useUtils();
  const { data: descImages, isLoading } = trpc.mall.getDescImages.useQuery({ productId });
  const addDescImage = trpc.mall.addDescImage.useMutation({
    onSuccess: () => {
      utils.mall.getDescImages.invalidate({ productId });
      toast.success("説明画像を追加しました");
    },
    onError: (err) => toast.error(err.message || "追加に失敗しました"),
  });
  const deleteDescImage = trpc.mall.deleteDescImage.useMutation({
    onSuccess: () => {
      utils.mall.getDescImages.invalidate({ productId });
      toast.success("削除しました");
    },
    onError: (err) => toast.error(err.message || "削除に失敗しました"),
  });
  const [isUploadingDesc, setIsUploadingDesc] = useState(false);
  const [captionInput, setCaptionInput] = useState("");

  const handleDescImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingDesc(true);
    const currentCount = descImages?.length || 0;
    let uploaded = 0;
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name}: 5MB以下にしてください`);
        continue;
      }
      try {
        const formDataUpload = new FormData();
        formDataUpload.append("file", file);
        const response = await fetch("/api/upload-product-image", {
          method: "POST",
          body: formDataUpload,
          credentials: "include",
        });
        if (!response.ok) throw new Error(`アップロード失敗 (${response.status})`);
        const result = await response.json();
        await addDescImage.mutateAsync({
          productId,
          imageUrl: result.url,
          imageKey: result.key,
          sortOrder: currentCount + uploaded,
          caption: captionInput || undefined,
        });
        uploaded++;
      } catch (error: any) {
        toast.error(`${file.name}: ${error?.message || 'アップロード失敗'}`);
      }
    }
    setIsUploadingDesc(false);
    setCaptionInput("");
    e.target.value = "";
  };

  return (
    <div className="col-span-2 border-t pt-4 mt-2">
      <label className="text-sm font-medium flex items-center gap-2">
        <FileImage className="h-4 w-4" />
        商品説明画像（図文モード）
      </label>
      <p className="text-xs text-muted-foreground mt-1 mb-3">
        商品詳細ページに表示されるLP風の説明画像です。上から順番に表示されます。
      </p>
      {/* 既存の説明画像一覧 */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">読み込み中...</div>
      ) : descImages && descImages.length > 0 ? (
        <div className="space-y-2 mb-3">
          {descImages.map((img, idx) => (
            <div key={img.id} className="flex items-center gap-3 border rounded-lg p-2">
              <span className="text-xs text-muted-foreground w-6">{idx + 1}</span>
              <img src={img.imageUrl} alt={img.caption || `説明${idx + 1}`} className="h-12 w-20 object-cover rounded" />
              <span className="text-xs text-muted-foreground flex-1 truncate">{img.caption || "キャプションなし"}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm("この説明画像を削除しますか？")) {
                    deleteDescImage.mutate({ id: img.id });
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground mb-3">説明画像はまだありません</div>
      )}
      {/* キャプション入力 */}
      <div className="flex items-center gap-2 mb-2">
        <Input
          placeholder="キャプション（任意）"
          value={captionInput}
          onChange={(e) => setCaptionInput(e.target.value)}
          className="flex-1 text-sm"
        />
      </div>
      {/* アップロードエリア */}
      <label className="cursor-pointer block">
        <div className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors ${
          isUploadingDesc ? "bg-muted" : "hover:bg-muted/50 hover:border-primary"
        }`}>
          {isUploadingDesc ? (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              <span className="text-sm text-muted-foreground">アップロード中...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">説明画像をアップロード（複数可）</span>
              <span className="text-xs text-muted-foreground">PNG, JPG, GIF（各5MB以下）</span>
            </div>
          )}
        </div>
        <Input
          type="file"
          accept="image/*"
          multiple
          onChange={handleDescImageUpload}
          disabled={isUploadingDesc}
          className="hidden"
        />
      </label>
    </div>
  );
}

// バリアント管理セクション
function VariantSection({ productId }: { productId: number }) {
  const utils = trpc.useUtils();
  const { data: variants, isLoading } = trpc.mall.getVariants.useQuery({ productId });
  const createVariant = trpc.mall.createVariant.useMutation({
    onSuccess: () => {
      utils.mall.getVariants.invalidate({ productId });
      toast.success("バリアントを追加しました");
    },
    onError: (err) => toast.error(err.message || "追加に失敗しました"),
  });
  const updateVariant = trpc.mall.updateVariant.useMutation({
    onSuccess: () => {
      utils.mall.getVariants.invalidate({ productId });
      toast.success("バリアントを更新しました");
    },
    onError: (err) => toast.error(err.message || "更新に失敗しました"),
  });
  const deleteVariant = trpc.mall.deleteVariant.useMutation({
    onSuccess: () => {
      utils.mall.getVariants.invalidate({ productId });
      toast.success("バリアントを削除しました");
    },
    onError: (err) => toast.error(err.message || "削除に失敗しました"),
  });

  const [newVariant, setNewVariant] = useState({
    name: "",
    variantType: "",
    sku: "",
    price: "",
    stock: "0",
  });
  const [editingVariantId, setEditingVariantId] = useState<number | null>(null);
  const [editVariant, setEditVariant] = useState({
    name: "",
    variantType: "",
    sku: "",
    price: "",
    stock: "0",
  });

  const handleAddVariant = () => {
    if (!newVariant.name.trim()) {
      toast.error("バリアント名を入力してください");
      return;
    }
    createVariant.mutate({
      productId,
      name: newVariant.name.trim(),
      variantType: newVariant.variantType || undefined,
      sku: newVariant.sku || undefined,
      price: newVariant.price ? Number(newVariant.price) : null,
      stock: Number(newVariant.stock) || 0,
      sortOrder: (variants?.length || 0),
    });
    setNewVariant({ name: "", variantType: "", sku: "", price: "", stock: "0" });
  };

  const handleStartEdit = (v: any) => {
    setEditingVariantId(v.id);
    setEditVariant({
      name: v.name,
      variantType: v.variantType || "",
      sku: v.sku || "",
      price: v.price != null ? String(v.price) : "",
      stock: String(v.stock),
    });
  };

  const handleSaveEdit = (id: number) => {
    updateVariant.mutate({
      id,
      name: editVariant.name.trim(),
      variantType: editVariant.variantType || null,
      sku: editVariant.sku || null,
      price: editVariant.price ? Number(editVariant.price) : null,
      stock: Number(editVariant.stock) || 0,
    });
    setEditingVariantId(null);
  };

  return (
    <div className="col-span-2 border-t pt-4 mt-2">
      <label className="text-sm font-medium flex items-center gap-2">
        <Package className="h-4 w-4" />
        バリアント（色・サイズ・SKU）
      </label>
      <p className="text-xs text-muted-foreground mt-1 mb-3">
        口紅の色号、シャンプーの容量等、商品の規格バリエーションを管理できます。
      </p>

      {/* 既存バリアント一覧 */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">読み込み中...</div>
      ) : variants && variants.length > 0 ? (
        <div className="space-y-2 mb-3">
          {variants.map((v) => (
            <div key={v.id} className="flex items-center gap-2 border rounded-lg p-2">
              {editingVariantId === v.id ? (
                <>
                  <Input
                    value={editVariant.name}
                    onChange={(e) => setEditVariant({ ...editVariant, name: e.target.value })}
                    placeholder="名前"
                    className="w-24 text-xs"
                  />
                  <Input
                    value={editVariant.variantType}
                    onChange={(e) => setEditVariant({ ...editVariant, variantType: e.target.value })}
                    placeholder="タイプ"
                    className="w-16 text-xs"
                  />
                  <Input
                    value={editVariant.sku}
                    onChange={(e) => setEditVariant({ ...editVariant, sku: e.target.value })}
                    placeholder="SKU"
                    className="w-20 text-xs"
                  />
                  <Input
                    value={editVariant.price}
                    onChange={(e) => setEditVariant({ ...editVariant, price: e.target.value })}
                    placeholder="価格"
                    type="number"
                    className="w-20 text-xs"
                  />
                  <Input
                    value={editVariant.stock}
                    onChange={(e) => setEditVariant({ ...editVariant, stock: e.target.value })}
                    placeholder="在庫"
                    type="number"
                    className="w-16 text-xs"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={() => handleSaveEdit(v.id)}>保存</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditingVariantId(null)}>×</Button>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium flex-1">{v.name}</span>
                  {v.variantType && <Badge variant="secondary" className="text-xs">{v.variantType}</Badge>}
                  {v.sku && <span className="text-xs text-muted-foreground">SKU:{v.sku}</span>}
                  {v.price != null && <span className="text-xs">¥{v.price.toLocaleString()}</span>}
                  <span className="text-xs text-muted-foreground">在庫:{v.stock}</span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => handleStartEdit(v)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm("このバリアントを削除しますか？")) {
                        deleteVariant.mutate({ id: v.id });
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground mb-3">バリアントはまだありません</div>
      )}

      {/* 新規バリアント追加 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          value={newVariant.name}
          onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })}
          placeholder="バリアント名 *"
          className="w-28 text-xs"
        />
        <Input
          value={newVariant.variantType}
          onChange={(e) => setNewVariant({ ...newVariant, variantType: e.target.value })}
          placeholder="タイプ(色,サイズ等)"
          className="w-28 text-xs"
        />
        <Input
          value={newVariant.sku}
          onChange={(e) => setNewVariant({ ...newVariant, sku: e.target.value })}
          placeholder="SKU"
          className="w-24 text-xs"
        />
        <Input
          value={newVariant.price}
          onChange={(e) => setNewVariant({ ...newVariant, price: e.target.value })}
          placeholder="価格(任意)"
          type="number"
          className="w-24 text-xs"
        />
        <Input
          value={newVariant.stock}
          onChange={(e) => setNewVariant({ ...newVariant, stock: e.target.value })}
          placeholder="在庫"
          type="number"
          className="w-16 text-xs"
        />
        <Button
          type="button"
          size="sm"
          onClick={handleAddVariant}
          disabled={createVariant.isPending}
        >
          <Plus className="h-3 w-3 mr-1" />追加
        </Button>
      </div>
    </div>
  );
}

export default function ProductManagement() {
  const { t } = useLanguage();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<number | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(initialFormData);
  const [filterStatus, setFilterStatus] = useState<ProductStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const utils = trpc.useUtils();

  const { data: products, isLoading } = trpc.mall.getProducts.useQuery(
    filterStatus === "all" ? undefined : { status: filterStatus }
  );

  // ブランド・カテゴリ一覧を取得
  const { data: brands } = trpc.brand.list.useQuery({});
  const { data: categories } = trpc.mall.getCategoryRecords.useQuery();

  // サブカテゴリ取得（親カテゴリが選択されている場合）
  const { data: subcategories } = trpc.mall.getSubcategories.useQuery(
    { parentId: formData.categoryId! },
    { enabled: !!formData.categoryId }
  );

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
    
    if (formData.price <= 0) {
      toast.error("価格は1円以上で入力してください。¥0の商品は登録できません。");
      return;
    }
    
    const submitData = {
      name: formData.name,
      description: formData.description || undefined,
      category: formData.category || undefined,
      brandId: formData.brandId,
      categoryId: formData.categoryId,
      subcategoryId: formData.subcategoryId,
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
      subcategoryId: (product as any).subcategoryId ?? null,
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
      toast.error(`メディアは最大${maxFiles}件までです`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      toast.info(`最大${maxFiles}件まで。${remainingSlots}件のみアップロードします`);
    }

    setIsUploading(true);
    let uploadedCount = 0;

    for (const file of filesToUpload) {
      const isVideo = file.type.startsWith("video/");
      const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error(`${file.name}: ${isVideo ? '50MB' : '5MB'}以下にしてください`);
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
      toast.success(`${uploadedCount}件アップロードしました`);
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

                  {/* 親カテゴリ選択 */}
                  <div>
                    <label className="text-sm font-medium">カテゴリ</label>
                    <Select
                      value={formData.categoryId ? String(formData.categoryId) : "none"}
                      onValueChange={(v) => {
                        const newCatId = v === "none" ? null : Number(v);
                        setFormData({ ...formData, categoryId: newCatId, subcategoryId: null });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="カテゴリを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">未設定</SelectItem>
                        {categories?.filter(c => c.isActive === "yes" && !c.parentId).map((cat) => (
                          <SelectItem key={cat.id} value={String(cat.id)}>
                            {cat.iconEmoji ? `${cat.iconEmoji} ` : ""}{cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* サブカテゴリ選択（親カテゴリが選択されている場合のみ表示） */}
                  {formData.categoryId && subcategories && subcategories.length > 0 && (
                    <div>
                      <label className="text-sm font-medium">サブカテゴリ</label>
                      <Select
                        value={formData.subcategoryId ? String(formData.subcategoryId) : "none"}
                        onValueChange={(v) => setFormData({ ...formData, subcategoryId: v === "none" ? null : Number(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="サブカテゴリを選択" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">未設定</SelectItem>
                          {subcategories.filter(c => c.isActive === "yes").map((sub) => (
                            <SelectItem key={sub.id} value={String(sub.id)}>
                              {sub.iconEmoji ? `${sub.iconEmoji} ` : ""}{sub.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

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

                  {/* 商品画像・動画アップロード */}
                  <div className="col-span-2">
                    <label className="text-sm font-medium">
                      商品画像/動画（最大10件・ドラッグで並び替え可能）
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
                                  クリックして画像/動画を選択（複数選択可）
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  画像: PNG,JPG,GIF(各5MB) / 動画: MP4,MOV(合50MB)・残り{10 - formData.images.length}件
                                </span>
                              </div>
                            )}
                          </div>
                          <Input
                            type="file"
                            accept="image/*,video/mp4,video/webm,video/quicktime,video/x-m4v"
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

                {/* 商品説明画像（図文モード）- 編集時のみ表示 */}
                {editingProduct && (
                  <DescImageSection productId={editingProduct} />
                )}

                {/* バリアント管理（編集時のみ表示） */}
                {editingProduct && (
                  <VariantSection productId={editingProduct} />
                )}

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
            <div className="flex items-center gap-4 flex-wrap">
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
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="商品名・ブランド・カテゴリで検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 商品一覧 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              商品一覧 {products && products.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  {searchQuery
                    ? `(${products.filter((p) => {
                        const q = searchQuery.toLowerCase();
                        const bn = getBrandName(p.brandId).toLowerCase();
                        const cn = getCategoryName(p.categoryId, p.category).toLowerCase();
                        return p.name.toLowerCase().includes(q) || bn.includes(q) || cn.includes(q) || (p.description?.toLowerCase().includes(q) ?? false);
                      }).length}件 / 全${products.length}件)`
                    : `(${products.length}件)`
                  }
                </span>
              )}
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
              <div className="space-y-3">
                {products
                .filter((product) => {
                  if (!searchQuery) return true;
                  const q = searchQuery.toLowerCase();
                  const brandName = getBrandName(product.brandId).toLowerCase();
                  const categoryName = getCategoryName(product.categoryId, product.category).toLowerCase();
                  return (
                    product.name.toLowerCase().includes(q) ||
                    brandName.includes(q) ||
                    categoryName.includes(q) ||
                    (product.description?.toLowerCase().includes(q) ?? false)
                  );
                })
                .map((product) => {
                  const imageCount = product.imageUrls?.length || (product.imageUrl ? 1 : 0);
                  return (
                    <div key={product.id} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-4">
                        {/* 画像 */}
                        <div className="relative flex-shrink-0">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="h-16 w-16 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center">
                              <ImageIcon className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          {imageCount > 1 && (
                            <Badge className="absolute -top-1 -right-1 text-[10px] px-1 py-0 min-w-[18px] h-[18px] flex items-center justify-center">
                              {imageCount}
                            </Badge>
                          )}
                        </div>

                        {/* 商品情報 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-sm truncate max-w-[300px]">{product.name}</h3>
                            {getStatusBadge(product.status)}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                            {product.brandId && (
                              <span>{getBrandName(product.brandId)}</span>
                            )}
                            {(product.categoryId || product.category) && (
                              <span>{getCategoryName(product.categoryId, product.category)}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm">
                            <span>¥{product.price.toLocaleString()}</span>
                            {product.pointPrice && (
                              <span className="text-muted-foreground">{product.pointPrice.toLocaleString()}pt</span>
                            )}
                            <span className="text-muted-foreground">在庫: {product.stock}</span>
                            {product.commissionRate && (
                              <span className="text-muted-foreground">報酬: {product.commissionRate}%</span>
                            )}
                          </div>
                        </div>

                        {/* 操作ボタン */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(product)}
                            title="編集"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(product.id)}
                            title="削除"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
