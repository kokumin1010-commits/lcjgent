import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  FileText,
  Tag,
  FolderOpen,
  ArrowLeft,
  Search,
  ExternalLink,
  BarChart3,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

// --- Category Management ---
function CategoryManager() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const utils = trpc.useUtils();
  const { data: categories, isLoading } = trpc.blog.listCategories.useQuery();
  const createMutation = trpc.blog.createCategory.useMutation({
    onSuccess: () => {
      utils.blog.listCategories.invalidate();
      setName("");
      setDescription("");
      setDialogOpen(false);
      toast.success("カテゴリを作成しました");
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.blog.updateCategory.useMutation({
    onSuccess: () => {
      utils.blog.listCategories.invalidate();
      setEditingId(null);
      toast.success("カテゴリを更新しました");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.blog.deleteCategory.useMutation({
    onSuccess: () => {
      utils.blog.listCategories.invalidate();
      toast.success("カテゴリを削除しました");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          カテゴリ管理
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              新規カテゴリ
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>カテゴリを作成</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>カテゴリ名</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例: 商品レビュー"
                />
              </div>
              <div>
                <Label>説明（任意）</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="カテゴリの説明"
                  rows={2}
                />
              </div>
              <Button
                onClick={() =>
                  createMutation.mutate({
                    name,
                    slug: slugify(name),
                    description: description || undefined,
                  })
                }
                disabled={!name.trim() || createMutation.isPending}
                className="w-full"
              >
                作成
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {categories && categories.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            カテゴリがまだありません
          </p>
        ) : (
          <div className="space-y-2">
            {categories?.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                {editingId === cat.id ? (
                  <div className="flex-1 flex gap-2 items-center">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8"
                    />
                    <Input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="説明"
                      className="h-8"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        updateMutation.mutate({
                          id: cat.id,
                          name: editName,
                          slug: slugify(editName),
                          description: editDescription || undefined,
                        })
                      }
                    >
                      保存
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      取消
                    </Button>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="font-medium">{cat.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        /{cat.slug}
                      </span>
                      {cat.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {cat.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingId(cat.id);
                          setEditName(cat.name);
                          setEditDescription(cat.description || "");
                        }}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => {
                          if (confirm("このカテゴリを削除しますか？"))
                            deleteMutation.mutate({ id: cat.id });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Tag Management ---
function TagManager() {
  const [name, setName] = useState("");
  const utils = trpc.useUtils();
  const { data: tags, isLoading } = trpc.blog.listTags.useQuery();
  const createMutation = trpc.blog.createTag.useMutation({
    onSuccess: () => {
      utils.blog.listTags.invalidate();
      setName("");
      toast.success("タグを作成しました");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.blog.deleteTag.useMutation({
    onSuccess: () => {
      utils.blog.listTags.invalidate();
      toast.success("タグを削除しました");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          タグ管理
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="新しいタグ名"
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                createMutation.mutate({ name, slug: slugify(name) });
              }
            }}
          />
          <Button
            onClick={() =>
              createMutation.mutate({ name, slug: slugify(name) })
            }
            disabled={!name.trim() || createMutation.isPending}
          >
            <Plus className="h-4 w-4 mr-1" />
            追加
          </Button>
        </div>
        {tags && tags.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            タグがまだありません
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags?.map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="text-sm py-1 px-3 gap-1.5"
              >
                {tag.name}
                <button
                  className="ml-1 hover:text-destructive transition-colors"
                  onClick={() => {
                    if (confirm(`タグ「${tag.name}」を削除しますか？`))
                      deleteMutation.mutate({ id: tag.id });
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Article List ---
function ArticleList() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = trpc.blog.list.useQuery(
    statusFilter !== "all"
      ? { status: statusFilter as "draft" | "published" | "scheduled" }
      : undefined
  );
  const { data: categories } = trpc.blog.listCategories.useQuery();
  const utils = trpc.useUtils();
  const toggleMutation = trpc.blog.togglePublish.useMutation({
    onSuccess: (result) => {
      utils.blog.list.invalidate();
      toast.success(
        result.status === "published" ? "記事を公開しました" : "記事を下書きに戻しました"
      );
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.blog.delete.useMutation({
    onSuccess: () => {
      utils.blog.list.invalidate();
      toast.success("記事を削除しました");
    },
    onError: (err) => toast.error(err.message),
  });

  const articles = data?.articles || [];
  const filtered = search
    ? articles.filter((a) =>
        a.title.toLowerCase().includes(search.toLowerCase())
      )
    : articles;

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId || !categories) return null;
    return categories.find((c) => c.id === categoryId)?.name;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          記事一覧
          {data && (
            <Badge variant="outline" className="ml-2">
              {data.total}件
            </Badge>
          )}
        </CardTitle>
        <Button onClick={() => navigate("/master/blog/new")}>
          <Plus className="h-4 w-4 mr-1" />
          新規記事
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="記事を検索..."
              className="pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm bg-background"
          >
            <option value="all">すべて</option>
            <option value="draft">下書き</option>
            <option value="published">公開中</option>
            <option value="scheduled">予約</option>
          </select>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>記事がまだありません</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate("/master/blog/new")}
            >
              最初の記事を作成する
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((article) => (
              <div
                key={article.id}
                className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/master/blog/edit/${article.id}`)}
              >
                {article.coverImageUrl ? (
                  <img
                    src={article.coverImageUrl}
                    alt=""
                    className="w-16 h-16 rounded-md object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{article.title}</h3>
                    <Badge
                      variant={
                        article.status === "published"
                          ? "default"
                          : article.status === "scheduled"
                          ? "secondary"
                          : "outline"
                      }
                      className="flex-shrink-0"
                    >
                      {article.status === "published"
                        ? "公開中"
                        : article.status === "scheduled"
                        ? "予約"
                        : "下書き"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {getCategoryName(article.categoryId) && (
                      <span className="flex items-center gap-1">
                        <FolderOpen className="h-3 w-3" />
                        {getCategoryName(article.categoryId)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {article.viewCount}
                    </span>
                    <span>
                      {new Date(article.updatedAt).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                  {article.excerpt && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {article.excerpt}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title={
                      article.status === "published" ? "下書きに戻す" : "公開する"
                    }
                    onClick={() => toggleMutation.mutate({ id: article.id })}
                  >
                    {article.status === "published" ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  {article.status === "published" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      title="公開ページを開く"
                      onClick={() =>
                        window.open(`/blog/${article.slug}`, "_blank")
                      }
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => {
                      if (confirm(`「${article.title}」を削除しますか？`))
                        deleteMutation.mutate({ id: article.id });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Main Blog Admin Page ---
export default function BlogAdmin() {
  const [, navigate] = useLocation();

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/master/mall")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">ブログ管理</h1>
          <p className="text-sm text-muted-foreground">
            LCJ MALLメディア記事の作成・管理
          </p>
        </div>
      </div>

      <Tabs defaultValue="articles">
        <TabsList>
          <TabsTrigger value="articles" className="gap-1.5">
            <FileText className="h-4 w-4" />
            記事
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5">
            <FolderOpen className="h-4 w-4" />
            カテゴリ
          </TabsTrigger>
          <TabsTrigger value="tags" className="gap-1.5">
            <Tag className="h-4 w-4" />
            タグ
          </TabsTrigger>
        </TabsList>
        <TabsContent value="articles" className="mt-4">
          <ArticleList />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <CategoryManager />
        </TabsContent>
        <TabsContent value="tags" className="mt-4">
          <TagManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
