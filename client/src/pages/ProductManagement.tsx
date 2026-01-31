import { useState } from "react";
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
import { Plus, Pencil, Trash2, Package, ImageIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

type ProductStatus = "draft" | "active" | "sold_out" | "archived";

interface ProductFormData {
  name: string;
  description: string;
  category: string;
  price: number;
  pointPrice: number | null;
  stock: number;
  imageUrl: string;
  status: ProductStatus;
  sortOrder: number;
}

const initialFormData: ProductFormData = {
  name: "",
  description: "",
  category: "",
  price: 0,
  pointPrice: null,
  stock: 0,
  imageUrl: "",
  status: "draft",
  sortOrder: 0,
};

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

  const createProduct = trpc.mall.createProduct.useMutation({
    onSuccess: () => {
      toast.success("商品を登録しました");
      utils.mall.getProducts.invalidate();
      setIsDialogOpen(false);
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
      ...formData,
      pointPrice: formData.pointPrice || undefined,
    };

    if (editingProduct) {
      updateProduct.mutate({ id: editingProduct, ...submitData });
    } else {
      createProduct.mutate(submitData);
    }
  };

  const handleEdit = (product: NonNullable<typeof products>[0]) => {
    setEditingProduct(product.id);
    setFormData({
      name: product.name,
      description: product.description || "",
      category: product.category || "",
      price: product.price,
      pointPrice: product.pointPrice,
      stock: product.stock,
      imageUrl: product.imageUrl || "",
      status: product.status as ProductStatus,
      sortOrder: product.sortOrder,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("この商品を削除しますか？")) {
      deleteProduct.mutate({ id });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formDataUpload,
      });

      if (!response.ok) throw new Error("Upload failed");

      const { url } = await response.json();
      setFormData((prev) => ({ ...prev, imageUrl: url }));
      toast.success("画像をアップロードしました");
    } catch (error) {
      toast.error("画像のアップロードに失敗しました");
    } finally {
      setIsUploading(false);
    }
  };

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

                  <div>
                    <label className="text-sm font-medium">カテゴリ</label>
                    <Input
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="カテゴリを入力"
                    />
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

                  <div className="col-span-2">
                    <label className="text-sm font-medium">商品画像</label>
                    <div className="flex items-center gap-4">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={isUploading}
                        className="flex-1"
                      />
                      {formData.imageUrl && (
                        <img
                          src={formData.imageUrl}
                          alt="Preview"
                          className="h-16 w-16 object-cover rounded"
                        />
                      )}
                    </div>
                    <Input
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder="または画像URLを直接入力"
                      className="mt-2"
                    />
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
                    <TableHead>カテゴリ</TableHead>
                    <TableHead className="text-right">価格</TableHead>
                    <TableHead className="text-right">ポイント価格</TableHead>
                    <TableHead className="text-right">在庫</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
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
                      </TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.category || "-"}</TableCell>
                      <TableCell className="text-right">
                        ¥{product.price.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.pointPrice ? `${product.pointPrice.toLocaleString()}pt` : "-"}
                      </TableCell>
                      <TableCell className="text-right">{product.stock}</TableCell>
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
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
