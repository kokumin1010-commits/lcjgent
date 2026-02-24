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
  Globe,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Send,
  FileCode,
  Link2,
  Bot,
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

// --- SEO Tools ---
function SEOTools() {
  const [submitting, setSubmitting] = useState(false);
  const [submittingAll, setSubmittingAll] = useState(false);
  const submitMutation = trpc.blog.submitToSearchEngines.useMutation();
  const submitAllMutation = trpc.blog.submitAllToSearchEngines.useMutation();
  const { data: articles } = trpc.blog.list.useQuery({ status: "published", limit: 1000 });
  const siteUrl = window.location.origin;

  const handleSubmitAll = async () => {
    setSubmittingAll(true);
    try {
      const result = await submitAllMutation.mutateAsync();
      toast.success(`${result.totalArticles || 0}件の記事を検索エンジンに送信しました`);
    } catch (e: any) {
      toast.error("送信に失敗しました: " + e.message);
    } finally {
      setSubmittingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">sitemap.xml</p>
                <p className="font-semibold text-green-600">有効</p>
              </div>
            </div>
            <a href="/sitemap.xml" target="_blank" className="text-xs text-blue-600 hover:underline mt-2 inline-flex items-center gap-1">
              <Link2 className="h-3 w-3" />確認する
            </a>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">robots.txt</p>
                <p className="font-semibold text-green-600">有効</p>
              </div>
            </div>
            <a href="/robots.txt" target="_blank" className="text-xs text-blue-600 hover:underline mt-2 inline-flex items-center gap-1">
              <Link2 className="h-3 w-3" />確認する
            </a>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">構造化データ</p>
                <p className="font-semibold text-green-600">JSON-LD有効</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Article + BreadcrumbList</p>
          </CardContent>
        </Card>
      </div>

      {/* IndexNow / Search Engine Submission */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            検索エンジンへの送信（IndexNow）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            記事を公開すると自動的にIndexNowでBing・Yandex等の検索エンジンに通知されます。
            Googleへは、Search Consoleでサイトマップを送信してください。
            以下のボタンで全公開記事をIndexNowに手動で再送信できます。
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={handleSubmitAll} disabled={submittingAll} className="gap-2">
              {submittingAll ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              全公開記事を検索エンジンに送信
            </Button>
            <span className="text-sm text-muted-foreground">
              {articles?.articles?.length || 0}件の公開記事
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Google Search Console Setup Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Google Search Console 設定ガイド
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <p className="font-medium">サイトを追加</p>
                <p className="text-sm text-muted-foreground">
                  <a href="https://search.google.com/search-console" target="_blank" className="text-blue-600 hover:underline">Google Search Console</a>
                  で「プロパティを追加」→「URLプレフィックス」を選択し、サイトURLを入力
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <p className="font-medium">所有権を確認</p>
                <p className="text-sm text-muted-foreground">
                  HTMLタグまたはDNSレコードで所有権を確認します
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <p className="font-medium">サイトマップを送信</p>
                <p className="text-sm text-muted-foreground">
                  Search Consoleの「サイトマップ」メニューで以下のURLを送信：
                </p>
                <code className="text-xs bg-muted px-2 py-1 rounded mt-1 inline-block">{siteUrl}/sitemap.xml</code>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
              <div>
                <p className="font-medium">完了</p>
                <p className="text-sm text-muted-foreground">
                  サイトマップ送信後、Googleが自動的に新しい記事をクロールします。
                  IndexNowはBing・Yandex向けに自動送信されます
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEO Features Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            実装済みSEO機能
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { name: "動的sitemap.xml", desc: "記事・カテゴリ・画像サイトマップ自動生成", active: true },
              { name: "robots.txt", desc: "クローラー制御・サイトマップ指定", active: true },
              { name: "JSON-LD構造化データ", desc: "Article + BreadcrumbListスキーマ", active: true },
              { name: "OGPメタタグ", desc: "Open Graph + Twitter Card対応", active: true },
              { name: "canonical URL", desc: "重複コンテンツ防止", active: true },
              { name: "IndexNow自動通知", desc: "記事公開時にBing・Yandexに自動通知", active: true },
              { name: "画像サイトマップ", desc: "カバー画像をサイトマップに含む", active: true },
              { name: "SEOメタ自動生成", desc: "AI記事生成時にSEOタイトル・ディスクリプション自動生成", active: true },
              { name: "Botプリレンダリング", desc: "Googlebot等にSSR HTMLを返却（メタタグ・構造化データ完備）", active: true },
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg border">
                <CheckCircle2 className={`h-4 w-4 ${feature.active ? "text-green-600" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium">{feature.name}</p>
                  <p className="text-xs text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Auto Post Quick Access ---
function AutoPostQuickAccess() {
  const [, navigate] = useLocation();
  const triggerMutation = trpc.autoPost.triggerNow.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`記事「${result.title || ''}」を${result.status === 'published' ? '公開' : '生成'}しました`);
      } else {
        toast.error(result.message || '自動投稿に失敗しました');
      }
    },
    onError: (err) => toast.error(err.message),
  });
  const { data: schedules } = trpc.autoPost.listSchedules.useQuery();
  const { data: logs } = trpc.autoPost.listLogs.useQuery({ limit: 5 });
  const { data: keywords } = trpc.autoPost.listKeywords.useQuery({ status: "pending", limit: 5 });

  const enabledSchedules = schedules?.filter((s: any) => s.isEnabled) || [];
  const pendingKeywords = keywords?.keywords || [];

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5" />
            AI自動投稿
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => triggerMutation.mutate({})}
              disabled={triggerMutation.isPending}
              className="gap-2"
            >
              {triggerMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              今すぐ記事を生成
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/master/auto-post")}
              className="gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              詳細設定を開く
            </Button>
          </div>

          {/* Status Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">有効なスケジュール</p>
              <p className="text-2xl font-bold">{enabledSchedules.length}件</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">待機中キーワード</p>
              <p className="text-2xl font-bold">{pendingKeywords.length}件</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">最新の実行</p>
              <p className="text-sm font-medium mt-1">
                {logs?.logs?.[0]
                  ? new Date(logs.logs[0].createdAt).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                  : "なし"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Logs */}
      {logs?.logs && logs.logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">最近の自動投稿履歴</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.logs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    {log.status === "published" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : log.status === "failed" ? (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <RefreshCw className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="truncate max-w-[200px]">{log.title || log.keyword || "不明"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Keywords Preview */}
      {pendingKeywords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">次に使われるキーワード</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {pendingKeywords.map((kw: any) => (
                <Badge key={kw.id} variant="secondary">{kw.keyword}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
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
          <TabsTrigger value="seo" className="gap-1.5">
            <Globe className="h-4 w-4" />
            SEO
          </TabsTrigger>
          <TabsTrigger value="autopost" className="gap-1.5">
            <Bot className="h-4 w-4" />
            自動投稿
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
        <TabsContent value="seo" className="mt-4">
          <SEOTools />
        </TabsContent>
        <TabsContent value="autopost" className="mt-4">
          <AutoPostQuickAccess />
        </TabsContent>
      </Tabs>
    </div>
  );
}
