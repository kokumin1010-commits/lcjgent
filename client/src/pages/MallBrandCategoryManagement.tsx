import { useState } from "react";
import { trpc } from "@/lib/trpc";
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
import { Plus, Pencil, Trash2, Tag, Building2, ImageIcon, GripVertical, Globe } from "lucide-react";
import { toast } from "sonner";

// ===== ブランド管理 =====

interface BrandFormData {
  name: string;
  nameEn: string;
  logoUrl: string;
  logoKey: string;
  description: string;
  website: string;
  sortOrder: number;
  isActive: "yes" | "no";
}

const initialBrandForm: BrandFormData = {
  name: "",
  nameEn: "",
  logoUrl: "",
  logoKey: "",
  description: "",
  website: "",
  sortOrder: 0,
  isActive: "yes",
};

function BrandManagementTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<BrandFormData>(initialBrandForm);
  const [isUploading, setIsUploading] = useState(false);

  const utils = trpc.useUtils();

  const { data: brands, isLoading } = trpc.mall.getBrands.useQuery();

  const createBrand = trpc.mall.createBrand.useMutation({
    onSuccess: () => {
      toast.success("ブランドを登録しました");
      utils.mall.getBrands.invalidate();
      closeDialog();
    },
    onError: (error) => {
      toast.error(error.message || "ブランドの登録に失敗しました");
    },
  });

  const updateBrand = trpc.mall.updateBrand.useMutation({
    onSuccess: () => {
      toast.success("ブランドを更新しました");
      utils.mall.getBrands.invalidate();
      closeDialog();
    },
    onError: (error) => {
      toast.error(error.message || "ブランドの更新に失敗しました");
    },
  });

  const deleteBrand = trpc.mall.deleteBrand.useMutation({
    onSuccess: () => {
      toast.success("ブランドを削除しました");
      utils.mall.getBrands.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "ブランドの削除に失敗しました");
    },
  });

  const uploadLogo = trpc.mall.uploadBrandLogo.useMutation({
    onSuccess: (data) => {
      setFormData((prev) => ({ ...prev, logoUrl: data.url, logoKey: data.key }));
      toast.success("ロゴをアップロードしました");
    },
    onError: (error) => {
      toast.error(error.message || "ロゴのアップロードに失敗しました");
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData(initialBrandForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      nameEn: formData.nameEn || undefined,
      logoUrl: formData.logoUrl || undefined,
      logoKey: formData.logoKey || undefined,
      description: formData.description || undefined,
      website: formData.website || undefined,
      sortOrder: formData.sortOrder,
      isActive: formData.isActive,
    };

    if (editingId) {
      updateBrand.mutate({ id: editingId, ...data });
    } else {
      createBrand.mutate(data);
    }
  };

  const handleEdit = (brand: NonNullable<typeof brands>[0]) => {
    setEditingId(brand.id);
    setFormData({
      name: brand.name,
      nameEn: brand.nameEn || "",
      logoUrl: brand.logoUrl || "",
      logoKey: brand.logoKey || "",
      description: brand.description || "",
      website: brand.website || "",
      sortOrder: brand.sortOrder,
      isActive: brand.isActive as "yes" | "no",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`ブランド「${name}」を削除しますか？\n※ このブランドに紐付いた商品のブランド設定が解除されます。`)) {
      deleteBrand.mutate({ id });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("ロゴ画像は2MB以下にしてください");
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await uploadLogo.mutateAsync({ base64, filename: file.name });
        setIsUploading(false);
      };
      reader.onerror = () => {
        toast.error("ファイルの読み込みに失敗しました");
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("ロゴのアップロードに失敗しました");
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          MALL商品に紐付けるブランドを管理します（{brands?.length || 0}件）
        </p>
        <Button onClick={() => { setFormData(initialBrandForm); setEditingId(null); setIsDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          ブランドを追加
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setIsDialogOpen(true); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "ブランドを編集" : "新規ブランド登録"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">ブランド名 *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例: SHISEIDO"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium">英語名</label>
              <Input
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                placeholder="例: Shiseido"
              />
            </div>

            <div>
              <label className="text-sm font-medium">説明</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="ブランドの説明"
                rows={2}
              />
            </div>

            <div>
              <label className="text-sm font-medium">ウェブサイト</label>
              <Input
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://example.com"
              />
            </div>

            <div>
              <label className="text-sm font-medium">ロゴ画像</label>
              <div className="mt-2 space-y-2">
                {formData.logoUrl && (
                  <div className="relative inline-block">
                    <img
                      src={formData.logoUrl}
                      alt="Logo"
                      className="h-20 w-20 object-contain rounded-lg border bg-white p-1"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                      onClick={() => setFormData({ ...formData, logoUrl: "", logoKey: "" })}
                    >
                      ×
                    </Button>
                  </div>
                )}
                <label className="block cursor-pointer">
                  <div className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors ${
                    isUploading ? "bg-muted" : "hover:bg-muted/50 hover:border-primary"
                  }`}>
                    {isUploading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                        <span className="text-sm text-muted-foreground">アップロード中...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">クリックしてロゴを選択（2MB以下）</span>
                      </div>
                    )}
                  </div>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
              </div>
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
              <Button type="submit" disabled={createBrand.isPending || updateBrand.isPending}>
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
          ) : !brands || brands.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              ブランドがありません。「ブランドを追加」から登録してください。
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ロゴ</TableHead>
                  <TableHead>ブランド名</TableHead>
                  <TableHead>英語名</TableHead>
                  <TableHead>ウェブサイト</TableHead>
                  <TableHead className="text-center">表示順</TableHead>
                  <TableHead className="text-center">ステータス</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brands.map((brand) => (
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
                    <TableCell className="text-muted-foreground">{brand.nameEn || "-"}</TableCell>
                    <TableCell>
                      {brand.website ? (
                        <a href={brand.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 text-sm">
                          <Globe className="h-3 w-3" />
                          リンク
                        </a>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-center">{brand.sortOrder}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={brand.isActive === "yes" ? "default" : "secondary"}>
                        {brand.isActive === "yes" ? "有効" : "無効"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(brand)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(brand.id, brand.name)}>
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
      parentId: category.parentId,
      iconEmoji: category.iconEmoji || "",
      sortOrder: category.sortOrder,
      isActive: category.isActive as "yes" | "no",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`カテゴリ「${name}」を削除しますか？\n※ このカテゴリに紐付いた商品のカテゴリ設定が解除されます。`)) {
      deleteCategory.mutate({ id });
    }
  };

  // 親カテゴリの選択肢（自分自身を除外）
  const parentOptions = categories?.filter((c) => c.id !== editingId) || [];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          MALL商品に紐付けるカテゴリを管理します（{categories?.length || 0}件）
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
                <label className="text-sm font-medium">スラッグ（URL用）</label>
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
                  maxLength={10}
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
                  <SelectValue placeholder="なし（トップレベル）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">なし（トップレベル）</SelectItem>
                  {parentOptions.map((cat) => (
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
                  <TableHead className="w-12">アイコン</TableHead>
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
                    ? categories.find((c) => c.id === category.parentId)?.name || "-"
                    : "-";
                  return (
                    <TableRow key={category.id}>
                      <TableCell className="text-xl">
                        {category.iconEmoji || <Tag className="h-5 w-5 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="font-medium">
                        {category.parentId && <span className="text-muted-foreground mr-1">└</span>}
                        {category.name}
                      </TableCell>
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
