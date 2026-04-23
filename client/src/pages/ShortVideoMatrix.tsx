import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Video,
  Users,
  TrendingUp,
  Calendar,
  BarChart3,
  Bookmark,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Lightbulb,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  Archive,
  X,
} from "lucide-react";

// ============================================================
// 型定義
// ============================================================
type Account = {
  id: number;
  accountName: string;
  displayName: string | null;
  platform: string;
  category: string | null;
  assignedTo: string | null;
  followerCount: number | null;
  profileUrl: string | null;
  avatarUrl: string | null;
  description: string | null;
  tags: string | null;
  status: "active" | "paused" | "archived";
  targetPostsPerDay: number | null;
  lastPostDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type VideoPost = {
  id: number;
  accountId: number;
  title: string | null;
  description: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  postDate: string;
  duration: number | null;
  hashtags: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  contentType: string | null;
  productName: string | null;
  status: "draft" | "scheduled" | "posted" | "failed";
  notes: string | null;
};

type Schedule = {
  id: number;
  accountId: number;
  scheduledDate: string;
  title: string | null;
  description: string | null;
  contentPlan: string | null;
  hashtags: string | null;
  assignedTo: string | null;
  status: "planned" | "in_progress" | "ready" | "posted" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  notes: string | null;
};

type ContentPlan = {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  targetAccounts: string | null;
  scriptContent: string | null;
  referenceUrls: string | null;
  hashtags: string | null;
  status: "idea" | "planning" | "scripted" | "filming" | "editing" | "ready" | "used" | "archived";
  assignedTo: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  notes: string | null;
};

// ============================================================
// ヘルパー関数
// ============================================================
function formatNumber(n: number | null | undefined): string {
  if (n == null) return "0";
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatDateTime(d: string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const platformLabels: Record<string, string> = {
  tiktok: "TikTok",
  youtube_shorts: "YouTube Shorts",
  instagram_reels: "Instagram Reels",
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  archived: "bg-gray-100 text-gray-800",
  draft: "bg-gray-100 text-gray-800",
  scheduled: "bg-blue-100 text-blue-800",
  posted: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  planned: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  ready: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
  idea: "bg-purple-100 text-purple-800",
  planning: "bg-blue-100 text-blue-800",
  scripted: "bg-cyan-100 text-cyan-800",
  filming: "bg-orange-100 text-orange-800",
  editing: "bg-yellow-100 text-yellow-800",
  used: "bg-green-100 text-green-800",
};

const statusLabels: Record<string, string> = {
  active: "アクティブ",
  paused: "一時停止",
  archived: "アーカイブ",
  draft: "下書き",
  scheduled: "予約済み",
  posted: "投稿済み",
  failed: "失敗",
  planned: "予定",
  in_progress: "進行中",
  ready: "準備完了",
  cancelled: "キャンセル",
  idea: "アイデア",
  planning: "企画中",
  scripted: "台本完成",
  filming: "撮影中",
  editing: "編集中",
  used: "使用済み",
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const priorityLabels: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "緊急",
};

// ============================================================
// メインコンポーネント
// ============================================================
export default function ShortVideoMatrix() {
  const [activeTab, setActiveTab] = useState("dashboard");
  
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">短動画マトリックス管理</h1>
          <p className="text-sm text-muted-foreground mt-1">TikTokアカウント・動画投稿の一元管理</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="dashboard" className="gap-1"><BarChart3 className="w-4 h-4" />ダッシュボード</TabsTrigger>
          <TabsTrigger value="accounts" className="gap-1"><Users className="w-4 h-4" />アカウント</TabsTrigger>
          <TabsTrigger value="posts" className="gap-1"><Video className="w-4 h-4" />投稿記録</TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1"><Calendar className="w-4 h-4" />スケジュール</TabsTrigger>
          <TabsTrigger value="content" className="gap-1"><Lightbulb className="w-4 h-4" />コンテンツ企画</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><DashboardTab /></TabsContent>
        <TabsContent value="accounts"><AccountsTab /></TabsContent>
        <TabsContent value="posts"><PostsTab /></TabsContent>
        <TabsContent value="schedule"><ScheduleTab /></TabsContent>
        <TabsContent value="content"><ContentPlanTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// ダッシュボードタブ
// ============================================================
function DashboardTab() {
  const { data: stats, isLoading } = trpc.svm.getDashboardStats.useQuery();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { data: dailyCounts } = trpc.svm.getDailyPostCounts.useQuery({ month: currentMonth });
  const { data: accounts } = trpc.svm.listAccounts.useQuery({ status: "active" });

  if (isLoading) return <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 mt-4">
      {/* KPIカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="w-4 h-4" />アカウント数</div>
            <div className="text-2xl font-bold mt-1">{stats?.accounts.active || 0}<span className="text-sm font-normal text-muted-foreground">/{stats?.accounts.total || 0}</span></div>
            <div className="text-xs text-muted-foreground">アクティブ/全体</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Video className="w-4 h-4" />今日の投稿</div>
            <div className="text-2xl font-bold mt-1">{stats?.posts.today || 0}</div>
            <div className="text-xs text-muted-foreground">今週: {stats?.posts.thisWeek || 0} / 今月: {stats?.posts.thisMonth || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Eye className="w-4 h-4" />今月の再生数</div>
            <div className="text-2xl font-bold mt-1">{formatNumber(stats?.performance.totalViews)}</div>
            <div className="text-xs text-muted-foreground">
              ❤️ {formatNumber(stats?.performance.totalLikes)} 💬 {formatNumber(stats?.performance.totalComments)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="w-4 h-4" />未完了スケジュール</div>
            <div className="text-2xl font-bold mt-1">{stats?.pendingSchedules || 0}</div>
            <div className="text-xs text-muted-foreground">企画: {stats?.contentPlans.active || 0}件進行中</div>
          </CardContent>
        </Card>
      </div>

      {/* アカウント一覧（簡易） */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">アクティブアカウント一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {!accounts || accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">アカウントが登録されていません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-2">アカウント</th>
                    <th className="py-2 px-2">プラットフォーム</th>
                    <th className="py-2 px-2">カテゴリ</th>
                    <th className="py-2 px-2">担当者</th>
                    <th className="py-2 px-2 text-right">フォロワー</th>
                    <th className="py-2 px-2">最終投稿</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a: Account) => (
                    <tr key={a.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2">
                        <div className="font-medium">{a.displayName || a.accountName}</div>
                        <div className="text-xs text-muted-foreground">@{a.accountName}</div>
                      </td>
                      <td className="py-2 px-2"><Badge variant="outline">{platformLabels[a.platform] || a.platform}</Badge></td>
                      <td className="py-2 px-2">{a.category || "-"}</td>
                      <td className="py-2 px-2">{a.assignedTo || "-"}</td>
                      <td className="py-2 px-2 text-right">{formatNumber(a.followerCount)}</td>
                      <td className="py-2 px-2 text-xs">{formatDate(a.lastPostDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// アカウント管理タブ
// ============================================================
function AccountsTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [form, setForm] = useState({
    accountName: "", displayName: "", platform: "tiktok", category: "", assignedTo: "",
    followerCount: 0, profileUrl: "", avatarUrl: "", description: "", tags: "",
    status: "active" as const, targetPostsPerDay: 1,
  });

  const { data: accounts, refetch } = trpc.svm.listAccounts.useQuery({
    status: statusFilter as any,
    search: search || undefined,
    category: categoryFilter === "all" ? undefined : categoryFilter,
  });
  const { data: categories } = trpc.svm.getCategories.useQuery();
  const createMut = trpc.svm.createAccount.useMutation({ onSuccess: () => { refetch(); setDialogOpen(false); toast.success("アカウントを追加しました"); } });
  const updateMut = trpc.svm.updateAccount.useMutation({ onSuccess: () => { refetch(); setDialogOpen(false); toast.success("アカウントを更新しました"); } });
  const deleteMut = trpc.svm.deleteAccount.useMutation({ onSuccess: () => { refetch(); toast.success("アカウントを削除しました"); } });

  const openCreate = () => {
    setEditAccount(null);
    setForm({ accountName: "", displayName: "", platform: "tiktok", category: "", assignedTo: "", followerCount: 0, profileUrl: "", avatarUrl: "", description: "", tags: "", status: "active", targetPostsPerDay: 1 });
    setDialogOpen(true);
  };

  const openEdit = (a: Account) => {
    setEditAccount(a);
    setForm({
      accountName: a.accountName, displayName: a.displayName || "", platform: a.platform,
      category: a.category || "", assignedTo: a.assignedTo || "", followerCount: a.followerCount || 0,
      profileUrl: a.profileUrl || "", avatarUrl: a.avatarUrl || "", description: a.description || "",
      tags: a.tags || "", status: a.status, targetPostsPerDay: a.targetPostsPerDay || 1,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.accountName.trim()) { toast.error("アカウント名は必須です"); return; }
    if (editAccount) {
      updateMut.mutate({ id: editAccount.id, ...form });
    } else {
      createMut.mutate(form);
    }
  };

  const handleDelete = (a: Account) => {
    if (confirm(`「${a.accountName}」を削除しますか？関連する投稿・スケジュールも削除されます。`)) {
      deleteMut.mutate({ id: a.id });
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="アカウント名で検索..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全ステータス</SelectItem>
            <SelectItem value="active">アクティブ</SelectItem>
            <SelectItem value="paused">一時停止</SelectItem>
            <SelectItem value="archived">アーカイブ</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全カテゴリ</SelectItem>
            {categories?.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" />アカウント追加</Button>
      </div>

      <div className="text-sm text-muted-foreground">{accounts?.length || 0}件のアカウント</div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left bg-muted/50">
              <th className="py-2 px-3">アカウント</th>
              <th className="py-2 px-3">プラットフォーム</th>
              <th className="py-2 px-3">カテゴリ</th>
              <th className="py-2 px-3">担当者</th>
              <th className="py-2 px-3 text-right">フォロワー</th>
              <th className="py-2 px-3">ステータス</th>
              <th className="py-2 px-3">目標/日</th>
              <th className="py-2 px-3">最終投稿</th>
              <th className="py-2 px-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {accounts?.map((a: Account) => (
              <tr key={a.id} className="border-b hover:bg-muted/50">
                <td className="py-2 px-3">
                  <div className="font-medium">{a.displayName || a.accountName}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.profileUrl ? (
                      <a href={a.profileUrl} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                        @{a.accountName}<ExternalLink className="w-3 h-3" />
                      </a>
                    ) : `@${a.accountName}`}
                  </div>
                </td>
                <td className="py-2 px-3"><Badge variant="outline">{platformLabels[a.platform] || a.platform}</Badge></td>
                <td className="py-2 px-3">{a.category || "-"}</td>
                <td className="py-2 px-3">{a.assignedTo || "-"}</td>
                <td className="py-2 px-3 text-right font-medium">{formatNumber(a.followerCount)}</td>
                <td className="py-2 px-3"><Badge className={statusColors[a.status]}>{statusLabels[a.status]}</Badge></td>
                <td className="py-2 px-3 text-center">{a.targetPostsPerDay || 1}</td>
                <td className="py-2 px-3 text-xs">{formatDate(a.lastPostDate)}</td>
                <td className="py-2 px-3">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(a)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* アカウント作成/編集ダイアログ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editAccount ? "アカウント編集" : "アカウント追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">アカウント名 *</label>
              <Input placeholder="@username" value={form.accountName} onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">表示名</label>
              <Input placeholder="表示名" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">プラットフォーム</label>
                <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="youtube_shorts">YouTube Shorts</SelectItem>
                    <SelectItem value="instagram_reels">Instagram Reels</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">ステータス</label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">アクティブ</SelectItem>
                    <SelectItem value="paused">一時停止</SelectItem>
                    <SelectItem value="archived">アーカイブ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">カテゴリ</label>
                <Input placeholder="美容, ヘアケア等" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">担当者</label>
                <Input placeholder="担当者名" value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">フォロワー数</label>
                <Input type="number" value={form.followerCount} onChange={e => setForm(f => ({ ...f, followerCount: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="text-sm font-medium">目標投稿数/日</label>
                <Input type="number" value={form.targetPostsPerDay} onChange={e => setForm(f => ({ ...f, targetPostsPerDay: parseInt(e.target.value) || 1 }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">プロフィールURL</label>
              <Input placeholder="https://www.tiktok.com/@..." value={form.profileUrl} onChange={e => setForm(f => ({ ...f, profileUrl: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">説明</label>
              <Textarea placeholder="アカウントの説明..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div>
              <label className="text-sm font-medium">タグ（カンマ区切り）</label>
              <Input placeholder="美容,ヘアケア,KYOGOKU" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// 投稿記録タブ
// ============================================================
function PostsTab() {
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPost, setEditPost] = useState<VideoPost | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [form, setForm] = useState({
    accountId: 0, title: "", description: "", videoUrl: "", thumbnailUrl: "",
    postDate: new Date().toISOString().slice(0, 16), duration: 0, hashtags: "",
    views: 0, likes: 0, comments: 0, shares: 0, saves: 0,
    contentType: "original", productName: "", status: "posted" as const, notes: "",
  });

  const { data: accounts } = trpc.svm.listAccounts.useQuery({ status: "active" });
  const { data: postsData, refetch } = trpc.svm.listPosts.useQuery({
    accountId: accountFilter !== "all" ? parseInt(accountFilter) : undefined,
    status: statusFilter as any,
    search: search || undefined,
    limit: pageSize,
    offset: page * pageSize,
  });
  const createMut = trpc.svm.createPost.useMutation({ onSuccess: () => { refetch(); setDialogOpen(false); toast.success("投稿を記録しました"); } });
  const updateMut = trpc.svm.updatePost.useMutation({ onSuccess: () => { refetch(); setDialogOpen(false); toast.success("投稿を更新しました"); } });
  const deleteMut = trpc.svm.deletePost.useMutation({ onSuccess: () => { refetch(); toast.success("投稿を削除しました"); } });

  const accountMap = useMemo(() => {
    const map: Record<number, Account> = {};
    accounts?.forEach((a: Account) => { map[a.id] = a; });
    return map;
  }, [accounts]);

  const openCreate = () => {
    setEditPost(null);
    setForm({
      accountId: accounts?.[0]?.id || 0, title: "", description: "", videoUrl: "", thumbnailUrl: "",
      postDate: new Date().toISOString().slice(0, 16), duration: 0, hashtags: "",
      views: 0, likes: 0, comments: 0, shares: 0, saves: 0,
      contentType: "original", productName: "", status: "posted", notes: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (p: VideoPost) => {
    setEditPost(p);
    setForm({
      accountId: p.accountId, title: p.title || "", description: p.description || "",
      videoUrl: p.videoUrl || "", thumbnailUrl: p.thumbnailUrl || "",
      postDate: p.postDate ? new Date(p.postDate).toISOString().slice(0, 16) : "",
      duration: p.duration || 0, hashtags: p.hashtags || "",
      views: p.views || 0, likes: p.likes || 0, comments: p.comments || 0,
      shares: p.shares || 0, saves: p.saves || 0,
      contentType: p.contentType || "original", productName: p.productName || "",
      status: p.status, notes: p.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.accountId) { toast.error("アカウントを選択してください"); return; }
    if (editPost) {
      updateMut.mutate({ id: editPost.id, ...form, postDate: form.postDate });
    } else {
      createMut.mutate({ ...form, postDate: form.postDate });
    }
  };

  const totalPages = Math.ceil((postsData?.total || 0) / pageSize);

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="タイトル・商品名で検索..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={accountFilter} onValueChange={v => { setAccountFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="アカウント" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全アカウント</SelectItem>
            {accounts?.map((a: Account) => <SelectItem key={a.id} value={String(a.id)}>@{a.accountName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全ステータス</SelectItem>
            <SelectItem value="posted">投稿済み</SelectItem>
            <SelectItem value="scheduled">予約済み</SelectItem>
            <SelectItem value="draft">下書き</SelectItem>
            <SelectItem value="failed">失敗</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" />投稿記録</Button>
      </div>

      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <span>{postsData?.total || 0}件の投稿</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
            <span>{page + 1}/{totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left bg-muted/50">
              <th className="py-2 px-3">アカウント</th>
              <th className="py-2 px-3">タイトル</th>
              <th className="py-2 px-3">投稿日</th>
              <th className="py-2 px-3">ステータス</th>
              <th className="py-2 px-3 text-right"><Eye className="w-3 h-3 inline" /> 再生</th>
              <th className="py-2 px-3 text-right"><Heart className="w-3 h-3 inline" /> いいね</th>
              <th className="py-2 px-3 text-right"><MessageCircle className="w-3 h-3 inline" /> コメント</th>
              <th className="py-2 px-3 text-right"><Share2 className="w-3 h-3 inline" /> シェア</th>
              <th className="py-2 px-3">商品</th>
              <th className="py-2 px-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {postsData?.items?.map((p: VideoPost) => (
              <tr key={p.id} className="border-b hover:bg-muted/50">
                <td className="py-2 px-3 text-xs">@{accountMap[p.accountId]?.accountName || p.accountId}</td>
                <td className="py-2 px-3">
                  <div className="max-w-[200px] truncate font-medium">{p.title || "(無題)"}</div>
                  {p.videoUrl && (
                    <a href={p.videoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                      動画を見る<ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </td>
                <td className="py-2 px-3 text-xs">{formatDateTime(p.postDate)}</td>
                <td className="py-2 px-3"><Badge className={statusColors[p.status]}>{statusLabels[p.status]}</Badge></td>
                <td className="py-2 px-3 text-right font-medium">{formatNumber(p.views)}</td>
                <td className="py-2 px-3 text-right">{formatNumber(p.likes)}</td>
                <td className="py-2 px-3 text-right">{formatNumber(p.comments)}</td>
                <td className="py-2 px-3 text-right">{formatNumber(p.shares)}</td>
                <td className="py-2 px-3 text-xs">{p.productName || "-"}</td>
                <td className="py-2 px-3">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("この投稿記録を削除しますか？")) deleteMut.mutate({ id: p.id }); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {(!postsData?.items || postsData.items.length === 0) && (
              <tr><td colSpan={10} className="py-8 text-center text-muted-foreground">投稿記録がありません</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 投稿作成/編集ダイアログ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editPost ? "投稿記録を編集" : "投稿を記録"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">アカウント *</label>
              <Select value={String(form.accountId)} onValueChange={v => setForm(f => ({ ...f, accountId: parseInt(v) }))}>
                <SelectTrigger><SelectValue placeholder="アカウントを選択" /></SelectTrigger>
                <SelectContent>
                  {accounts?.map((a: Account) => <SelectItem key={a.id} value={String(a.id)}>@{a.accountName} {a.displayName ? `(${a.displayName})` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">タイトル</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">投稿日時</label>
                <Input type="datetime-local" value={form.postDate} onChange={e => setForm(f => ({ ...f, postDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">ステータス</label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="posted">投稿済み</SelectItem>
                    <SelectItem value="scheduled">予約済み</SelectItem>
                    <SelectItem value="draft">下書き</SelectItem>
                    <SelectItem value="failed">失敗</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">動画URL</label>
              <Input placeholder="https://www.tiktok.com/..." value={form.videoUrl} onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">動画の長さ（秒）</label>
                <Input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="text-sm font-medium">コンテンツタイプ</label>
                <Select value={form.contentType} onValueChange={v => setForm(f => ({ ...f, contentType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">オリジナル</SelectItem>
                    <SelectItem value="repost">リポスト</SelectItem>
                    <SelectItem value="collaboration">コラボ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">商品名</label>
              <Input placeholder="関連商品名" value={form.productName} onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">ハッシュタグ（カンマ区切り）</label>
              <Input placeholder="#美容,#ヘアケア" value={form.hashtags} onChange={e => setForm(f => ({ ...f, hashtags: e.target.value }))} />
            </div>
            <div className="grid grid-cols-5 gap-2">
              <div>
                <label className="text-xs font-medium">再生数</label>
                <Input type="number" value={form.views} onChange={e => setForm(f => ({ ...f, views: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="text-xs font-medium">いいね</label>
                <Input type="number" value={form.likes} onChange={e => setForm(f => ({ ...f, likes: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="text-xs font-medium">コメント</label>
                <Input type="number" value={form.comments} onChange={e => setForm(f => ({ ...f, comments: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="text-xs font-medium">シェア</label>
                <Input type="number" value={form.shares} onChange={e => setForm(f => ({ ...f, shares: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="text-xs font-medium">保存</label>
                <Input type="number" value={form.saves} onChange={e => setForm(f => ({ ...f, saves: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">説明</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div>
              <label className="text-sm font-medium">メモ</label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// スケジュールタブ
// ============================================================
function ScheduleTab() {
  const [accountFilter, setAccountFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [form, setForm] = useState({
    accountId: 0, scheduledDate: new Date().toISOString().slice(0, 16), title: "",
    description: "", contentPlan: "", hashtags: "", assignedTo: "",
    status: "planned" as const, priority: "medium" as const, notes: "",
  });

  const { data: accounts } = trpc.svm.listAccounts.useQuery({ status: "active" });
  const { data: schedules, refetch } = trpc.svm.listSchedules.useQuery({
    accountId: accountFilter !== "all" ? parseInt(accountFilter) : undefined,
    status: statusFilter as any,
  });
  const createMut = trpc.svm.createSchedule.useMutation({ onSuccess: () => { refetch(); setDialogOpen(false); toast.success("スケジュールを追加しました"); } });
  const updateMut = trpc.svm.updateSchedule.useMutation({ onSuccess: () => { refetch(); setDialogOpen(false); toast.success("スケジュールを更新しました"); } });
  const deleteMut = trpc.svm.deleteSchedule.useMutation({ onSuccess: () => { refetch(); toast.success("スケジュールを削除しました"); } });

  const accountMap = useMemo(() => {
    const map: Record<number, Account> = {};
    accounts?.forEach((a: Account) => { map[a.id] = a; });
    return map;
  }, [accounts]);

  const openCreate = () => {
    setEditSchedule(null);
    setForm({
      accountId: accounts?.[0]?.id || 0, scheduledDate: new Date().toISOString().slice(0, 16), title: "",
      description: "", contentPlan: "", hashtags: "", assignedTo: "",
      status: "planned", priority: "medium", notes: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (s: Schedule) => {
    setEditSchedule(s);
    setForm({
      accountId: s.accountId, scheduledDate: s.scheduledDate ? new Date(s.scheduledDate).toISOString().slice(0, 16) : "",
      title: s.title || "", description: s.description || "", contentPlan: s.contentPlan || "",
      hashtags: s.hashtags || "", assignedTo: s.assignedTo || "",
      status: s.status, priority: s.priority, notes: s.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.accountId) { toast.error("アカウントを選択してください"); return; }
    if (editSchedule) {
      updateMut.mutate({ id: editSchedule.id, ...form });
    } else {
      createMut.mutate(form);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="アカウント" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全アカウント</SelectItem>
            {accounts?.map((a: Account) => <SelectItem key={a.id} value={String(a.id)}>@{a.accountName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全ステータス</SelectItem>
            <SelectItem value="planned">予定</SelectItem>
            <SelectItem value="in_progress">進行中</SelectItem>
            <SelectItem value="ready">準備完了</SelectItem>
            <SelectItem value="posted">投稿済み</SelectItem>
            <SelectItem value="cancelled">キャンセル</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" />スケジュール追加</Button>
      </div>

      <div className="text-sm text-muted-foreground">{schedules?.length || 0}件のスケジュール</div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left bg-muted/50">
              <th className="py-2 px-3">予定日</th>
              <th className="py-2 px-3">アカウント</th>
              <th className="py-2 px-3">タイトル</th>
              <th className="py-2 px-3">担当者</th>
              <th className="py-2 px-3">優先度</th>
              <th className="py-2 px-3">ステータス</th>
              <th className="py-2 px-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {schedules?.map((s: Schedule) => (
              <tr key={s.id} className="border-b hover:bg-muted/50">
                <td className="py-2 px-3 text-xs font-medium">{formatDateTime(s.scheduledDate)}</td>
                <td className="py-2 px-3 text-xs">@{accountMap[s.accountId]?.accountName || s.accountId}</td>
                <td className="py-2 px-3 max-w-[200px] truncate">{s.title || "(無題)"}</td>
                <td className="py-2 px-3">{s.assignedTo || "-"}</td>
                <td className="py-2 px-3"><Badge className={priorityColors[s.priority]}>{priorityLabels[s.priority]}</Badge></td>
                <td className="py-2 px-3"><Badge className={statusColors[s.status]}>{statusLabels[s.status]}</Badge></td>
                <td className="py-2 px-3">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("削除しますか？")) deleteMut.mutate({ id: s.id }); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {(!schedules || schedules.length === 0) && (
              <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">スケジュールがありません</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* スケジュール作成/編集ダイアログ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editSchedule ? "スケジュール編集" : "スケジュール追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">アカウント *</label>
              <Select value={String(form.accountId)} onValueChange={v => setForm(f => ({ ...f, accountId: parseInt(v) }))}>
                <SelectTrigger><SelectValue placeholder="アカウントを選択" /></SelectTrigger>
                <SelectContent>
                  {accounts?.map((a: Account) => <SelectItem key={a.id} value={String(a.id)}>@{a.accountName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">予定日時</label>
                <Input type="datetime-local" value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">担当者</label>
                <Input value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">タイトル</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">優先度</label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="urgent">緊急</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">ステータス</label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">予定</SelectItem>
                    <SelectItem value="in_progress">進行中</SelectItem>
                    <SelectItem value="ready">準備完了</SelectItem>
                    <SelectItem value="posted">投稿済み</SelectItem>
                    <SelectItem value="cancelled">キャンセル</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">コンテンツ企画</label>
              <Textarea value={form.contentPlan} onChange={e => setForm(f => ({ ...f, contentPlan: e.target.value }))} rows={2} placeholder="投稿内容の企画..." />
            </div>
            <div>
              <label className="text-sm font-medium">ハッシュタグ</label>
              <Input value={form.hashtags} onChange={e => setForm(f => ({ ...f, hashtags: e.target.value }))} placeholder="#美容,#ヘアケア" />
            </div>
            <div>
              <label className="text-sm font-medium">メモ</label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// コンテンツ企画タブ
// ============================================================
function ContentPlanTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<ContentPlan | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", category: "", targetAccounts: "",
    scriptContent: "", referenceUrls: "", hashtags: "",
    status: "idea" as const, assignedTo: "", priority: "medium" as const,
    dueDate: "", notes: "",
  });

  const { data: plans, refetch } = trpc.svm.listContentPlans.useQuery({
    status: statusFilter as any,
    search: search || undefined,
  });
  const createMut = trpc.svm.createContentPlan.useMutation({ onSuccess: () => { refetch(); setDialogOpen(false); toast.success("企画を追加しました"); } });
  const updateMut = trpc.svm.updateContentPlan.useMutation({ onSuccess: () => { refetch(); setDialogOpen(false); toast.success("企画を更新しました"); } });
  const deleteMut = trpc.svm.deleteContentPlan.useMutation({ onSuccess: () => { refetch(); toast.success("企画を削除しました"); } });

  const openCreate = () => {
    setEditPlan(null);
    setForm({ title: "", description: "", category: "", targetAccounts: "", scriptContent: "", referenceUrls: "", hashtags: "", status: "idea", assignedTo: "", priority: "medium", dueDate: "", notes: "" });
    setDialogOpen(true);
  };

  const openEdit = (p: ContentPlan) => {
    setEditPlan(p);
    setForm({
      title: p.title, description: p.description || "", category: p.category || "",
      targetAccounts: p.targetAccounts || "", scriptContent: p.scriptContent || "",
      referenceUrls: p.referenceUrls || "", hashtags: p.hashtags || "",
      status: p.status, assignedTo: p.assignedTo || "", priority: p.priority,
      dueDate: p.dueDate ? new Date(p.dueDate).toISOString().slice(0, 10) : "", notes: p.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.title.trim()) { toast.error("タイトルは必須です"); return; }
    if (editPlan) {
      updateMut.mutate({ id: editPlan.id, ...form, dueDate: form.dueDate || undefined });
    } else {
      createMut.mutate({ ...form, dueDate: form.dueDate || undefined });
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="企画名で検索..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全ステータス</SelectItem>
            <SelectItem value="idea">アイデア</SelectItem>
            <SelectItem value="planning">企画中</SelectItem>
            <SelectItem value="scripted">台本完成</SelectItem>
            <SelectItem value="filming">撮影中</SelectItem>
            <SelectItem value="editing">編集中</SelectItem>
            <SelectItem value="ready">準備完了</SelectItem>
            <SelectItem value="used">使用済み</SelectItem>
            <SelectItem value="archived">アーカイブ</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" />企画追加</Button>
      </div>

      <div className="text-sm text-muted-foreground">{plans?.length || 0}件の企画</div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {plans?.map((p: ContentPlan) => (
          <Card key={p.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4 pb-3 space-y-2">
              <div className="flex justify-between items-start">
                <h3 className="font-medium text-sm line-clamp-2">{p.title}</h3>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Edit className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm("削除しますか？")) deleteMut.mutate({ id: p.id }); }}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                </div>
              </div>
              {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
              <div className="flex flex-wrap gap-1">
                <Badge className={statusColors[p.status]}>{statusLabels[p.status]}</Badge>
                <Badge className={priorityColors[p.priority]}>{priorityLabels[p.priority]}</Badge>
                {p.category && <Badge variant="outline">{p.category}</Badge>}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{p.assignedTo || "未割当"}</span>
                {p.dueDate && <span>期限: {formatDate(p.dueDate)}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
        {(!plans || plans.length === 0) && (
          <div className="col-span-full py-8 text-center text-muted-foreground">コンテンツ企画がありません</div>
        )}
      </div>

      {/* 企画作成/編集ダイアログ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editPlan ? "企画編集" : "企画追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">タイトル *</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">説明</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">カテゴリ</label>
                <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="美容, ヘアケア等" />
              </div>
              <div>
                <label className="text-sm font-medium">担当者</label>
                <Input value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">ステータス</label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="idea">アイデア</SelectItem>
                    <SelectItem value="planning">企画中</SelectItem>
                    <SelectItem value="scripted">台本完成</SelectItem>
                    <SelectItem value="filming">撮影中</SelectItem>
                    <SelectItem value="editing">編集中</SelectItem>
                    <SelectItem value="ready">準備完了</SelectItem>
                    <SelectItem value="used">使用済み</SelectItem>
                    <SelectItem value="archived">アーカイブ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">優先度</label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="urgent">緊急</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">期限</label>
                <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">台本・スクリプト</label>
              <Textarea value={form.scriptContent} onChange={e => setForm(f => ({ ...f, scriptContent: e.target.value }))} rows={4} placeholder="動画の台本内容..." />
            </div>
            <div>
              <label className="text-sm font-medium">参考URL（改行区切り）</label>
              <Textarea value={form.referenceUrls} onChange={e => setForm(f => ({ ...f, referenceUrls: e.target.value }))} rows={2} placeholder="https://..." />
            </div>
            <div>
              <label className="text-sm font-medium">ハッシュタグ</label>
              <Input value={form.hashtags} onChange={e => setForm(f => ({ ...f, hashtags: e.target.value }))} placeholder="#美容,#ヘアケア" />
            </div>
            <div>
              <label className="text-sm font-medium">対象アカウント（カンマ区切り）</label>
              <Input value={form.targetAccounts} onChange={e => setForm(f => ({ ...f, targetAccounts: e.target.value }))} placeholder="@account1,@account2" />
            </div>
            <div>
              <label className="text-sm font-medium">メモ</label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
