import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Tag, Building2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// ===== ブランド管理タブ（既存ブランド管理への案内） =====

function BrandManagementTab() {
  const [, navigate] = useLocation();
  const { data: brands, isLoading } = trpc.brand.list.useQuery({});

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          MALL商品のブランドは営業ブランド管理と共有しています（{brands?.length || 0}件）
        </p>
        <Button onClick={() => navigate("/master/brands")}>
          <ExternalLink className="mr-2 h-4 w-4" />
          ブランド管理を開く
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
          ) : !brands || brands.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              ブランドがありません。ブランド管理ページから登録してください。
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ロゴ</TableHead>
                  <TableHead>ブランド名</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>商材カテゴリ</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brands.map((brand: any) => (
                  <TableRow key={brand.id}>
                    <TableCell>
                      {brand.logoUrl ? (
                        <img
                          src={brand.logoUrl}
                          alt={brand.name}
                          className="h-10 w-10 object-contain rounded bg-white border p-0.5"
                        />
                      ) : (
                        <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{brand.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {brand.status || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{brand.materialCategory || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/master/brands/${brand.id}`)}>
                        <ExternalLink className="h-4 w-4 mr-1" />
                        詳細
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ===== カテゴリ管理 =====

interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
  parentId: number | null;
  iconEmoji: string;
  sortOrder: number;
  isActive: "yes" | "no";
}

const initialCategoryForm: CategoryFormData = {
  name: "",
  slug: "",
  description: "",
  parentId: null,
  iconEmoji: "",
  sortOrder: 0,
  isActive: "yes",
};

function CategoryManagementTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(initialCategoryForm);

  const utils = trpc.useUtils();

  const { data: categories, isLoading } = trpc.mall.getCategoryRecords.useQuery();

  const createCategory = trpc.mall.createCategory.useMutation({
    onSuccess: () => {
      toast.success("カテゴリを登録しました");
      utils.mall.getCategoryRecords.invalidate();
      closeDialog();
    },
    onError: (error) => {
      toast.error(error.message || "カテゴリの登録に失敗しました");
    },
  });

  const updateCategory = trpc.mall.updateCategory.useMutation({
    onSuccess: () => {
      toast.success("カテゴリを更新しました");
      utils.mall.getCategoryRecords.invalidate();
      closeDialog();
    },
    onError: (error) => {
      toast.error(error.message || "カテゴリの更新に失敗しました");
    },
  });

  const deleteCategory = trpc.mall.deleteCategory.useMutation({
    onSuccess: () => {
      toast.success("カテゴリを削除しました");
      utils.mall.getCategoryRecords.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "カテゴリの削除に失敗しました");
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData(initialCategoryForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      slug: formData.slug || undefined,
      description: formData.description || undefined,
      parentId: formData.parentId || undefined,
      iconEmoji: formData.iconEmoji || undefined,
      sortOrder: formData.sortOrder,
      isActive: formData.isActive,
    };

    if (editingId) {
      updateCategory.mutate({ id: editingId, ...data });
    } else {
      createCategory.mutate(data);
    }
  };

  const handleEdit = (category: NonNullable<typeof categories>[0]) => {
    setEditingId(category.id);
    setFormData({
      name: category.name,
      slug: category.slug || "",
      description: category.description || "",
      parentId: category.parentId ?? null,
      iconEmoji: category.iconEmoji || "",
      sortOrder: category.sortOrder,
      isActive: category.isActive as "yes" | "no",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`カテゴリ「${name}」を削除しますか？`)) {
      deleteCategory.mutate({ id });
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          MALL商品のカテゴリを管理します（{categories?.length || 0}件）
        </p>
        <Button onClick={() => { setFormData(initialCategoryForm); setEditingId(null); setIsDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          カテゴリを追加
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setIsDialogOpen(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "カテゴリを編集" : "新規カテゴリ登録"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">カテゴリ名 *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例: スキンケア"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">スラッグ</label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="例: skincare"
                />
              </div>
              <div>
                <label className="text-sm font-medium">アイコン絵文字</label>
                <Input
                  value={formData.iconEmoji}
                  onChange={(e) => setFormData({ ...formData, iconEmoji: e.target.value })}
                  placeholder="例: 🧴"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">説明</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="カテゴリの説明"
                rows={2}
              />
            </div>

            <div>
              <label className="text-sm font-medium">親カテゴリ</label>
              <Select
                value={formData.parentId ? String(formData.parentId) : "none"}
                onValueChange={(v) => setFormData({ ...formData, parentId: v === "none" ? null : Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="親カテゴリを選択（任意）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">なし（トップレベル）</SelectItem>
                  {categories?.filter(c => c.id !== editingId).map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.iconEmoji ? `${cat.iconEmoji} ` : ""}{cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">表示順</label>
                <Input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">ステータス</label>
                <Select
                  value={formData.isActive}
                  onValueChange={(v: "yes" | "no") => setFormData({ ...formData, isActive: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">有効</SelectItem>
                    <SelectItem value="no">無効</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                キャンセル
              </Button>
              <Button type="submit" disabled={createCategory.isPending || updateCategory.isPending}>
                {editingId ? "更新" : "登録"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
          ) : !categories || categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              カテゴリがありません。「カテゴリを追加」から登録してください。
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">アイコン</TableHead>
                  <TableHead>カテゴリ名</TableHead>
                  <TableHead>スラッグ</TableHead>
                  <TableHead>親カテゴリ</TableHead>
                  <TableHead className="text-center">表示順</TableHead>
                  <TableHead className="text-center">ステータス</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => {
                  const parentName = category.parentId
                    ? categories.find(c => c.id === category.parentId)?.name || "-"
                    : "-";
                  return (
                    <TableRow key={category.id}>
                      <TableCell className="text-2xl text-center">
                        {category.iconEmoji || "📁"}
                      </TableCell>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{category.slug || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{parentName}</TableCell>
                      <TableCell className="text-center">{category.sortOrder}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={category.isActive === "yes" ? "default" : "secondary"}>
                          {category.isActive === "yes" ? "有効" : "無効"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(category)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(category.id, category.name)}>
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
    </>
  );
}

// ===== メインコンポーネント =====

export default function MallBrandCategoryManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ブランド・カテゴリ管理</h1>
        <p className="text-muted-foreground">LCJ MALL商品のブランドとカテゴリを管理します</p>
      </div>

      <Tabs defaultValue="brands" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="brands" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            ブランド
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            カテゴリ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="brands" className="mt-6">
          <BrandManagementTab />
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <CategoryManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
