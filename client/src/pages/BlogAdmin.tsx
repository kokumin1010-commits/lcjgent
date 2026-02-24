import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
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
  Clock,
  Target,
  TrendingUp,
  Zap,
  XCircle,
  Loader2,
  Image as ImageIcon,
  AlertTriangle,
  RotateCcw,
  Sparkles,
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

// --- Full Auto Post Panel (integrated from AutoPostAdmin) ---
function FullAutoPostPanel() {
  const [subTab, setSubTab] = useState("overview");
  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <Bot className="h-4 w-4" />
            概要
          </TabsTrigger>
          <TabsTrigger value="schedules" className="gap-1.5">
            <Clock className="h-4 w-4" />
            スケジュール
          </TabsTrigger>
          <TabsTrigger value="keywords" className="gap-1.5">
            <Target className="h-4 w-4" />
            キーワード
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            実行履歴
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <AutoPostOverview />
        </TabsContent>
        <TabsContent value="schedules" className="mt-4">
          <ScheduleManager />
        </TabsContent>
        <TabsContent value="keywords" className="mt-4">
          <KeywordManager />
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
          <ExecutionLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- Auto Post Overview ---
function AutoPostOverview() {
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
  const { data: stats, isLoading: statsLoading } = trpc.autoPost.stats.useQuery();
  const { data: logs } = trpc.autoPost.listLogs.useQuery({ limit: 5 });
  const { data: keywords } = trpc.autoPost.listKeywords.useQuery({ enabled: true });

  const pendingKeywords = keywords || [];

  return (
    <div className="space-y-4">
      {/* Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16" /></CardContent></Card>
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "アクティブスケジュール", value: `${stats.activeSchedules}/${stats.totalSchedules}`, icon: Clock, color: "text-green-500" },
            { label: "生成済み記事", value: String(stats.totalPostsGenerated), icon: FileText, color: "text-blue-500" },
            { label: "残りキーワード", value: `${stats.unusedKeywords}/${stats.totalKeywords}`, icon: Target, color: "text-purple-500" },
            { label: "キーワード使用率", value: `${stats.totalKeywords > 0 ? Math.round(((stats.totalKeywords - stats.unusedKeywords) / stats.totalKeywords) * 100) : 0}%`, icon: TrendingUp, color: "text-orange-500" },
          ].map((stat, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Action */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => triggerMutation.mutate({ autoPublish: 'publish' })}
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
          </div>
        </CardContent>
      </Card>

      {/* Recent Logs */}
      {logs && logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">最近の自動投稿履歴</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    {log.status === "published" || log.status === "completed" ? (
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

      {/* Pending Keywords */}
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

// --- Schedule Manager (from AutoPostAdmin) ---
function ScheduleManager() {
  const utils = trpc.useUtils();
  const { data: schedules, isLoading } = trpc.autoPost.listSchedules.useQuery();
  const { data: categories } = trpc.blog.listCategories.useQuery();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    intervalDays: 1,
    preferredHour: 10,
    keywordStrategy: "preset" as "preset" | "custom" | "ai_suggest",
    articleType: "guide" as "guide" | "review" | "comparison" | "news" | "howto" | "listicle",
    tone: "professional" as "professional" | "casual" | "friendly" | "authoritative",
    articleLength: "standard" as "short" | "standard" | "long",
    language: "ja" as "ja" | "en" | "zh" | "ko" | "th",
    generateImages: true,
    autoPublish: "draft" as "draft" | "publish" | "scheduled",
    categoryId: null as number | null,
  });

  const createMutation = trpc.autoPost.createSchedule.useMutation({
    onSuccess: () => { utils.autoPost.listSchedules.invalidate(); utils.autoPost.stats.invalidate(); setShowCreateDialog(false); resetForm(); toast.success("スケジュールを作成しました"); },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.autoPost.updateSchedule.useMutation({
    onSuccess: () => { utils.autoPost.listSchedules.invalidate(); setEditingSchedule(null); resetForm(); toast.success("スケジュールを更新しました"); },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.autoPost.deleteSchedule.useMutation({
    onSuccess: () => { utils.autoPost.listSchedules.invalidate(); utils.autoPost.stats.invalidate(); toast.success("スケジュールを削除しました"); },
  });
  const toggleMutation = trpc.autoPost.toggleSchedule.useMutation({
    onSuccess: () => { utils.autoPost.listSchedules.invalidate(); utils.autoPost.stats.invalidate(); },
  });
  const executeMutation = trpc.autoPost.executeNow.useMutation({
    onSuccess: (result) => { utils.autoPost.listSchedules.invalidate(); utils.autoPost.listLogs.invalidate(); utils.autoPost.stats.invalidate(); toast.success(`記事を生成しました: ${result.title}`); },
    onError: (err) => toast.error(`生成失敗: ${err.message}`),
  });

  function resetForm() {
    setFormData({ name: "", intervalDays: 1, preferredHour: 10, keywordStrategy: "preset", articleType: "guide", tone: "professional", articleLength: "standard", language: "ja", generateImages: true, autoPublish: "draft", categoryId: null });
  }
  function openEdit(schedule: any) {
    setEditingSchedule(schedule);
    setFormData({ name: schedule.name, intervalDays: schedule.intervalDays, preferredHour: schedule.preferredHour, keywordStrategy: schedule.keywordStrategy, articleType: schedule.articleType, tone: schedule.tone, articleLength: schedule.articleLength, language: schedule.language, generateImages: schedule.generateImages, autoPublish: schedule.autoPublish, categoryId: schedule.categoryId || null });
  }
  function handleSubmit() {
    if (editingSchedule) { updateMutation.mutate({ id: editingSchedule.id, ...formData }); }
    else { createMutation.mutate(formData); }
  }

  const articleTypes = [
    { value: "guide", label: "ガイド記事" }, { value: "review", label: "レビュー記事" },
    { value: "comparison", label: "比較記事" }, { value: "howto", label: "ハウツー記事" },
    { value: "listicle", label: "リスト記事" }, { value: "news", label: "ニュース記事" },
  ];
  const tones = [
    { value: "professional", label: "プロフェッショナル" }, { value: "casual", label: "カジュアル" },
    { value: "friendly", label: "フレンドリー" }, { value: "authoritative", label: "権威的" },
  ];
  const lengths = [
    { value: "short", label: "短い (1500-2000字)" }, { value: "standard", label: "標準 (3000-4000字)" }, { value: "long", label: "長い (5000-6000字)" },
  ];

  if (isLoading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;

  const dialogOpen = showCreateDialog || !!editingSchedule;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">自動投稿スケジュール</h3>
        <Button onClick={() => setShowCreateDialog(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          新規スケジュール
        </Button>
      </div>

      {(!schedules || schedules.length === 0) ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">スケジュールがありません</p>
            <p className="text-sm mt-1">「新規スケジュール」から自動投稿を設定しましょう</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {schedules.map((schedule: any) => (
            <Card key={schedule.id} className={schedule.enabled ? "border-green-500/30" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold truncate">{schedule.name}</h4>
                      <Badge variant={schedule.enabled ? "default" : "secondary"} className="shrink-0">
                        {schedule.enabled ? "稼働中" : "停止中"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-2">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{schedule.intervalDays}日ごと / {schedule.preferredHour}時</span>
                      <span>|</span>
                      <span>{articleTypes.find(t => t.value === schedule.articleType)?.label || schedule.articleType}</span>
                      <span>|</span>
                      <span>公開: {schedule.autoPublish === 'publish' ? '即時公開' : schedule.autoPublish === 'scheduled' ? '予約' : '下書き'}</span>
                      <span>|</span>
                      <span>生成済み: {schedule.totalGenerated || 0}件</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {schedule.generateImages && <Badge variant="outline" className="text-xs"><ImageIcon className="h-3 w-3 mr-1" />画像自動生成</Badge>}
                      <Badge variant="outline" className="text-xs">{schedule.keywordStrategy === 'preset' ? 'プリセットKW' : schedule.keywordStrategy === 'ai_suggest' ? 'AI提案' : 'カスタムKW'}</Badge>
                    </div>
                    {schedule.nextRunAt && schedule.enabled && (
                      <p className="text-xs text-muted-foreground mt-2">次回実行: {new Date(schedule.nextRunAt).toLocaleString('ja-JP')}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Switch checked={schedule.enabled} onCheckedChange={(checked) => toggleMutation.mutate({ id: schedule.id, enabled: checked })} />
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => executeMutation.mutate({ scheduleId: schedule.id })} disabled={executeMutation.isPending} title="今すぐ実行">
                      {executeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(schedule)} title="編集"><Edit className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("このスケジュールを削除しますか？")) deleteMutation.mutate({ id: schedule.id }); }} title="削除">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setEditingSchedule(null); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? "スケジュール編集" : "新規スケジュール作成"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>スケジュール名</Label><Input value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="例: TikTok Shop日本語記事" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>投稿間隔（日）</Label><Input type="number" min={1} max={30} value={formData.intervalDays} onChange={(e) => setFormData(prev => ({ ...prev, intervalDays: parseInt(e.target.value) || 1 }))} /></div>
              <div><Label>希望実行時刻</Label><Select value={String(formData.preferredHour)} onValueChange={(v) => setFormData(prev => ({ ...prev, preferredHour: parseInt(v) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 24 }, (_, i) => (<SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>))}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>記事タイプ</Label><Select value={formData.articleType} onValueChange={(v: any) => setFormData(prev => ({ ...prev, articleType: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{articleTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>トーン</Label><Select value={formData.tone} onValueChange={(v: any) => setFormData(prev => ({ ...prev, tone: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{tones.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>記事の長さ</Label><Select value={formData.articleLength} onValueChange={(v: any) => setFormData(prev => ({ ...prev, articleLength: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{lengths.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>言語</Label><Select value={formData.language} onValueChange={(v: any) => setFormData(prev => ({ ...prev, language: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ja">日本語</SelectItem><SelectItem value="en">English</SelectItem><SelectItem value="zh">中文</SelectItem><SelectItem value="ko">한국어</SelectItem><SelectItem value="th">ไทย</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>キーワード戦略</Label><Select value={formData.keywordStrategy} onValueChange={(v: any) => setFormData(prev => ({ ...prev, keywordStrategy: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="preset">プリセット</SelectItem><SelectItem value="custom">カスタム</SelectItem><SelectItem value="ai_suggest">AI提案</SelectItem></SelectContent></Select></div>
              <div><Label>公開設定</Label><Select value={formData.autoPublish} onValueChange={(v: any) => setFormData(prev => ({ ...prev, autoPublish: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">下書き保存</SelectItem><SelectItem value="publish">即時公開</SelectItem><SelectItem value="scheduled">予約公開</SelectItem></SelectContent></Select></div>
            </div>
            <div><Label>カテゴリ</Label><Select value={formData.categoryId?.toString() || "none"} onValueChange={(v) => setFormData(prev => ({ ...prev, categoryId: v === "none" ? null : parseInt(v) }))}><SelectTrigger><SelectValue placeholder="カテゴリなし" /></SelectTrigger><SelectContent><SelectItem value="none">カテゴリなし</SelectItem>{categories?.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex items-center justify-between"><Label>カバー画像を自動生成</Label><Switch checked={formData.generateImages} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, generateImages: checked }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setEditingSchedule(null); resetForm(); }}>キャンセル</Button>
            <Button onClick={handleSubmit} disabled={!formData.name || createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editingSchedule ? "更新" : "作成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Keyword Manager (from AutoPostAdmin) ---
function KeywordManager() {
  const utils = trpc.useUtils();
  const { data: keywords, isLoading } = trpc.autoPost.listKeywords.useQuery();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newKeyword, setNewKeyword] = useState({ keyword: "", category: "custom", priority: 5 });

  const addMutation = trpc.autoPost.addKeyword.useMutation({
    onSuccess: () => { utils.autoPost.listKeywords.invalidate(); utils.autoPost.stats.invalidate(); setShowAddDialog(false); setNewKeyword({ keyword: "", category: "custom", priority: 5 }); toast.success("キーワードを追加しました"); },
    onError: (err) => toast.error(err.message),
  });
  const generateMutation = trpc.autoPost.generateKeywords.useMutation({
    onSuccess: (result) => { utils.autoPost.listKeywords.invalidate(); utils.autoPost.stats.invalidate(); toast.success(`AIが${result.inserted}個のキーワードを自動生成しました`); },
    onError: (err) => toast.error(`キーワード生成に失敗: ${err.message}`),
  });
  const deleteMutation = trpc.autoPost.deleteKeyword.useMutation({
    onSuccess: () => { utils.autoPost.listKeywords.invalidate(); utils.autoPost.stats.invalidate(); toast.success("キーワードを削除しました"); },
  });
  const resetMutation = trpc.autoPost.resetKeywords.useMutation({
    onSuccess: () => { utils.autoPost.listKeywords.invalidate(); utils.autoPost.stats.invalidate(); toast.success("全キーワードの使用回数をリセットしました"); },
  });

  const filteredKeywords = useMemo(() => {
    if (!keywords) return [];
    return keywords.filter((k: any) => {
      if (search && !k.keyword.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== "all" && k.category !== categoryFilter) return false;
      return true;
    });
  }, [keywords, search, categoryFilter]);

  const kwCategories = useMemo(() => {
    if (!keywords) return [];
    return Array.from(new Set(keywords.map((k: any) => k.category).filter(Boolean))) as string[];
  }, [keywords]);

  const usedCount = keywords?.filter((k: any) => k.usedCount > 0).length || 0;
  const totalCount = keywords?.length || 0;
  const usagePercent = totalCount > 0 ? Math.round((usedCount / totalCount) * 100) : 0;

  if (isLoading) return <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold">キーワード管理</h3>
          <p className="text-sm text-muted-foreground">{usedCount}/{totalCount} 使用済み ({usagePercent}%)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { toast.info("AIがキーワードを生成中です..."); generateMutation.mutate({ count: 20 }); }} disabled={generateMutation.isPending} className="gap-1.5">
            {generateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            AI自動生成
          </Button>
          <Button variant="outline" size="sm" onClick={() => { if (confirm("全キーワードの使用回数をリセットしますか？")) resetMutation.mutate(); }} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />リセット
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />追加
          </Button>
        </div>
      </div>
      <Progress value={usagePercent} className="h-2" />
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="キーワード検索..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全カテゴリ</SelectItem>
            {kwCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2 max-h-[500px] overflow-y-auto">
        {filteredKeywords.map((kw: any) => (
          <div key={kw.id} className={`flex items-center justify-between p-3 rounded-lg border ${kw.usedCount > 0 ? "bg-muted/50 opacity-70" : "bg-card"}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-medium text-sm truncate ${kw.usedCount > 0 ? "line-through" : ""}`}>{kw.keyword}</span>
                  {kw.usedCount > 0 && <Badge variant="secondary" className="text-xs shrink-0">使用{kw.usedCount}回</Badge>}
                  {!kw.enabled && <Badge variant="destructive" className="text-xs shrink-0">無効</Badge>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-xs">{kw.category || 'なし'}</Badge>
                  <span className="text-xs text-muted-foreground">優先度: {kw.priority}</span>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => { if (confirm("このキーワードを削除しますか？")) deleteMutation.mutate({ id: kw.id }); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {filteredKeywords.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">キーワードが見つかりません</p>
          </div>
        )}
      </div>
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>キーワード追加</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>キーワード</Label><Input value={newKeyword.keyword} onChange={(e) => setNewKeyword(prev => ({ ...prev, keyword: e.target.value }))} placeholder="例: TikTok Shop 人気商品 2026" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>カテゴリ</Label><Select value={newKeyword.category} onValueChange={(v) => setNewKeyword(prev => ({ ...prev, category: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="custom">カスタム</SelectItem><SelectItem value="TikTok Shop基礎">TikTok Shop基礎</SelectItem><SelectItem value="TikTok Shop販売">TikTok Shop販売</SelectItem><SelectItem value="TikTok Shopマーケティング">TikTok Shopマーケティング</SelectItem><SelectItem value="TikTok Shop運営">TikTok Shop運営</SelectItem><SelectItem value="EC一般">EC一般</SelectItem></SelectContent></Select></div>
              <div><Label>優先度 (0-10)</Label><Input type="number" min={0} max={10} value={newKeyword.priority} onChange={(e) => setNewKeyword(prev => ({ ...prev, priority: parseInt(e.target.value) || 5 }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>キャンセル</Button>
            <Button onClick={() => addMutation.mutate(newKeyword)} disabled={!newKeyword.keyword || addMutation.isPending}>
              {addMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Execution Logs (from AutoPostAdmin) ---
function ExecutionLogs() {
  const utils = trpc.useUtils();
  const { data: logs, isLoading } = trpc.autoPost.listLogs.useQuery();
  const recoverMutation = trpc.autoPost.recoverStuck.useMutation({
    onSuccess: (result) => { utils.autoPost.listLogs.invalidate(); toast.success(`${result.recovered}/${result.total} 件をリカバリーしました`); },
    onError: (err) => toast.error(err.message),
  });
  const stuckCount = logs?.filter((l: any) => l.status === 'generating' || l.status === 'image_generating').length || 0;
  const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
    completed: { label: "完了", icon: CheckCircle2, color: "text-green-500" },
    published: { label: "公開済み", icon: CheckCircle2, color: "text-green-500" },
    failed: { label: "失敗", icon: XCircle, color: "text-red-500" },
    pending: { label: "待機中", icon: Clock, color: "text-yellow-500" },
    generating: { label: "記事生成中", icon: Loader2, color: "text-blue-500" },
    image_generating: { label: "画像生成中", icon: ImageIcon, color: "text-purple-500" },
    publishing: { label: "公開中", icon: FileText, color: "text-orange-500" },
  };

  if (isLoading) return <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">実行履歴</h3>
        {stuckCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => recoverMutation.mutate()} disabled={recoverMutation.isPending} className="gap-1.5 text-orange-600">
            {recoverMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {stuckCount}件スタック中 - リカバリー
          </Button>
        )}
      </div>
      {(!logs || logs.length === 0) ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">実行履歴がありません</p>
            <p className="text-sm mt-1">スケジュールを作成して実行すると、ここに履歴が表示されます</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log: any) => {
            const config = statusConfig[log.status] || statusConfig.pending;
            const StatusIcon = config.icon;
            return (
              <Card key={log.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <StatusIcon className={`h-5 w-5 mt-0.5 shrink-0 ${config.color} ${log.status === 'generating' || log.status === 'image_generating' ? 'animate-spin' : ''}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={log.status === 'completed' || log.status === 'published' ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'} className="text-xs">{config.label}</Badge>
                          {log.keyword && <span className="text-sm font-medium truncate">{log.keyword}</span>}
                        </div>
                        {log.errorMessage && <p className="text-xs text-red-500 mt-1 truncate">{log.errorMessage}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(log.createdAt).toLocaleString('ja-JP')}
                          {log.completedAt && ` → ${new Date(log.completedAt).toLocaleString('ja-JP')}`}
                        </p>
                      </div>
                    </div>
                    {log.articleId && (
                      <Button variant="ghost" size="sm" className="shrink-0 text-xs" asChild>
                        <a href={`/master/blog/edit/${log.articleId}`}><FileText className="h-3.5 w-3.5 mr-1" />記事</a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
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
          <FullAutoPostPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
