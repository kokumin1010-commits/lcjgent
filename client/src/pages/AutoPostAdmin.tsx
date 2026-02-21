import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Trash2,
  Edit,
  Zap,
  Clock,
  BarChart3,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  Bot,
  Image as ImageIcon,
  FileText,
  Target,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

// ==================== Dashboard Stats ====================
function DashboardStats() {
  const { data: stats, isLoading } = trpc.autoPost.stats.useQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-16" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const usagePercent = stats.totalKeywords > 0
    ? Math.round(((stats.totalKeywords - stats.unusedKeywords) / stats.totalKeywords) * 100)
    : 0;

  const statCards = [
    { label: "アクティブスケジュール", value: `${stats.activeSchedules}/${stats.totalSchedules}`, icon: Clock, color: "text-green-500" },
    { label: "生成済み記事", value: String(stats.totalPostsGenerated), icon: FileText, color: "text-blue-500" },
    { label: "残りキーワード", value: `${stats.unusedKeywords}/${stats.totalKeywords}`, icon: Target, color: "text-purple-500" },
    { label: "キーワード使用率", value: `${usagePercent}%`, icon: TrendingUp, color: "text-orange-500" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statCards.map((stat, i) => (
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
  );
}

// ==================== Schedule Manager ====================
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
    onSuccess: () => {
      utils.autoPost.listSchedules.invalidate();
      utils.autoPost.stats.invalidate();
      setShowCreateDialog(false);
      resetForm();
      toast.success("スケジュールを作成しました");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.autoPost.updateSchedule.useMutation({
    onSuccess: () => {
      utils.autoPost.listSchedules.invalidate();
      setEditingSchedule(null);
      resetForm();
      toast.success("スケジュールを更新しました");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.autoPost.deleteSchedule.useMutation({
    onSuccess: () => {
      utils.autoPost.listSchedules.invalidate();
      utils.autoPost.stats.invalidate();
      toast.success("スケジュールを削除しました");
    },
  });

  const toggleMutation = trpc.autoPost.toggleSchedule.useMutation({
    onSuccess: () => {
      utils.autoPost.listSchedules.invalidate();
      utils.autoPost.stats.invalidate();
    },
  });

  const executeMutation = trpc.autoPost.executeNow.useMutation({
    onSuccess: (result) => {
      utils.autoPost.listSchedules.invalidate();
      utils.autoPost.listLogs.invalidate();
      utils.autoPost.stats.invalidate();
      toast.success(`記事を生成しました: ${result.title}`);
    },
    onError: (err) => toast.error(`生成失敗: ${err.message}`),
  });

  function resetForm() {
    setFormData({
      name: "",
      intervalDays: 1,
      preferredHour: 10,
      keywordStrategy: "preset",
      articleType: "guide",
      tone: "professional",
      articleLength: "standard",
      language: "ja",
      generateImages: true,
      autoPublish: "draft",
      categoryId: null,
    });
  }

  function openEdit(schedule: any) {
    setEditingSchedule(schedule);
    setFormData({
      name: schedule.name,
      intervalDays: schedule.intervalDays,
      preferredHour: schedule.preferredHour,
      keywordStrategy: schedule.keywordStrategy,
      articleType: schedule.articleType,
      tone: schedule.tone,
      articleLength: schedule.articleLength,
      language: schedule.language,
      generateImages: schedule.generateImages,
      autoPublish: schedule.autoPublish,
      categoryId: schedule.categoryId || null,
    });
  }

  function handleSubmit() {
    if (editingSchedule) {
      updateMutation.mutate({ id: editingSchedule.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  }

  const articleTypes = [
    { value: "guide", label: "ガイド記事" },
    { value: "review", label: "レビュー記事" },
    { value: "comparison", label: "比較記事" },
    { value: "howto", label: "ハウツー記事" },
    { value: "listicle", label: "リスト記事" },
    { value: "news", label: "ニュース記事" },
  ];

  const tones = [
    { value: "professional", label: "プロフェッショナル" },
    { value: "casual", label: "カジュアル" },
    { value: "friendly", label: "フレンドリー" },
    { value: "authoritative", label: "権威的" },
  ];

  const lengths = [
    { value: "short", label: "短い (1500-2000字)" },
    { value: "standard", label: "標準 (3000-4000字)" },
    { value: "long", label: "長い (5000-6000字)" },
  ];

  if (isLoading) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  }

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
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {schedule.intervalDays}日ごと / {schedule.preferredHour}時
                      </span>
                      <span>|</span>
                      <span>{articleTypes.find(t => t.value === schedule.articleType)?.label || schedule.articleType}</span>
                      <span>|</span>
                      <span>公開: {schedule.autoPublish === 'publish' ? '即時公開' : schedule.autoPublish === 'scheduled' ? '予約' : '下書き'}</span>
                      <span>|</span>
                      <span>生成済み: {schedule.totalGenerated || 0}件</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {schedule.generateImages && (
                        <Badge variant="outline" className="text-xs"><ImageIcon className="h-3 w-3 mr-1" />画像自動生成</Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {schedule.keywordStrategy === 'preset' ? 'プリセットKW' : schedule.keywordStrategy === 'ai_suggest' ? 'AI提案' : 'カスタムKW'}
                      </Badge>
                    </div>
                    {schedule.nextRunAt && schedule.enabled && (
                      <p className="text-xs text-muted-foreground mt-2">
                        次回実行: {new Date(schedule.nextRunAt).toLocaleString('ja-JP')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Switch
                      checked={schedule.enabled}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: schedule.id, enabled: checked })}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => executeMutation.mutate({ scheduleId: schedule.id })}
                      disabled={executeMutation.isPending}
                      title="今すぐ実行"
                    >
                      {executeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(schedule)} title="編集">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => { if (confirm("このスケジュールを削除しますか？")) deleteMutation.mutate({ id: schedule.id }); }}
                      title="削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setEditingSchedule(null); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? "スケジュール編集" : "新規スケジュール作成"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>スケジュール名</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例: TikTok Shop日本語記事"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>投稿間隔（日）</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={formData.intervalDays}
                  onChange={(e) => setFormData(prev => ({ ...prev, intervalDays: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div>
                <Label>希望実行時刻</Label>
                <Select value={String(formData.preferredHour)} onValueChange={(v) => setFormData(prev => ({ ...prev, preferredHour: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>記事タイプ</Label>
                <Select value={formData.articleType} onValueChange={(v: any) => setFormData(prev => ({ ...prev, articleType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {articleTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>トーン</Label>
                <Select value={formData.tone} onValueChange={(v: any) => setFormData(prev => ({ ...prev, tone: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tones.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>記事の長さ</Label>
                <Select value={formData.articleLength} onValueChange={(v: any) => setFormData(prev => ({ ...prev, articleLength: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {lengths.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>言語</Label>
                <Select value={formData.language} onValueChange={(v: any) => setFormData(prev => ({ ...prev, language: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ja">日本語</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="zh">中文</SelectItem>
                    <SelectItem value="ko">한국어</SelectItem>
                    <SelectItem value="th">ไทย</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>キーワード戦略</Label>
                <Select value={formData.keywordStrategy} onValueChange={(v: any) => setFormData(prev => ({ ...prev, keywordStrategy: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preset">プリセット</SelectItem>
                    <SelectItem value="custom">カスタム</SelectItem>
                    <SelectItem value="ai_suggest">AI提案</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>公開設定</Label>
                <Select value={formData.autoPublish} onValueChange={(v: any) => setFormData(prev => ({ ...prev, autoPublish: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">下書き保存</SelectItem>
                    <SelectItem value="publish">即時公開</SelectItem>
                    <SelectItem value="scheduled">予約公開</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>カテゴリ</Label>
              <Select
                value={formData.categoryId?.toString() || "none"}
                onValueChange={(v) => setFormData(prev => ({ ...prev, categoryId: v === "none" ? null : parseInt(v) }))}
              >
                <SelectTrigger><SelectValue placeholder="カテゴリなし" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">カテゴリなし</SelectItem>
                  {categories?.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>カバー画像を自動生成</Label>
              <Switch
                checked={formData.generateImages}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, generateImages: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setEditingSchedule(null); resetForm(); }}>
              キャンセル
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editingSchedule ? "更新" : "作成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== Keyword Manager ====================
function KeywordManager() {
  const utils = trpc.useUtils();
  const { data: keywords, isLoading } = trpc.autoPost.listKeywords.useQuery();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newKeyword, setNewKeyword] = useState({ keyword: "", category: "custom", priority: 5 });

  const addMutation = trpc.autoPost.addKeyword.useMutation({
    onSuccess: () => {
      utils.autoPost.listKeywords.invalidate();
      utils.autoPost.stats.invalidate();
      setShowAddDialog(false);
      setNewKeyword({ keyword: "", category: "custom", priority: 5 });
      toast.success("キーワードを追加しました");
    },
    onError: (err) => toast.error(err.message),
  });

  const generateMutation = trpc.autoPost.generateKeywords.useMutation({
    onSuccess: (result) => {
      utils.autoPost.listKeywords.invalidate();
      utils.autoPost.stats.invalidate();
      toast.success(`AIが${result.inserted}個のキーワードを自動生成しました`);
    },
    onError: (err) => toast.error(`キーワード生成に失敗: ${err.message}`),
  });

  const deleteMutation = trpc.autoPost.deleteKeyword.useMutation({
    onSuccess: () => {
      utils.autoPost.listKeywords.invalidate();
      utils.autoPost.stats.invalidate();
      toast.success("キーワードを削除しました");
    },
  });

  const resetMutation = trpc.autoPost.resetKeywords.useMutation({
    onSuccess: () => {
      utils.autoPost.listKeywords.invalidate();
      utils.autoPost.stats.invalidate();
      toast.success("全キーワードの使用回数をリセットしました");
    },
  });

  const filteredKeywords = useMemo(() => {
    if (!keywords) return [];
    return keywords.filter((k: any) => {
      if (search && !k.keyword.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== "all" && k.category !== categoryFilter) return false;
      return true;
    });
  }, [keywords, search, categoryFilter]);

  const categories = useMemo(() => {
    if (!keywords) return [];
    const cats = new Set(keywords.map((k: any) => k.category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [keywords]);

  const usedCount = keywords?.filter((k: any) => k.usedCount > 0).length || 0;
  const totalCount = keywords?.length || 0;
  const usagePercent = totalCount > 0 ? Math.round((usedCount / totalCount) * 100) : 0;

  if (isLoading) {
    return <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold">キーワード管理</h3>
          <p className="text-sm text-muted-foreground">
            {usedCount}/{totalCount} 使用済み ({usagePercent}%)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              toast.info("AIがキーワードを生成中です...（30秒ほどかかります）");
              generateMutation.mutate({ count: 20 });
            }}
            disabled={generateMutation.isPending}
            className="gap-1.5"
          >
            {generateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            AI自動生成
          </Button>
          <Button variant="outline" size="sm" onClick={() => { if (confirm("全キーワードの使用回数をリセットしますか？")) resetMutation.mutate(); }} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            リセット
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            追加
          </Button>
        </div>
      </div>

      <Progress value={usagePercent} className="h-2" />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="キーワード検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全カテゴリ</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2 max-h-[500px] overflow-y-auto">
        {filteredKeywords.map((kw: any) => (
          <div
            key={kw.id}
            className={`flex items-center justify-between p-3 rounded-lg border ${kw.usedCount > 0 ? "bg-muted/50 opacity-70" : "bg-card"}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-medium text-sm truncate ${kw.usedCount > 0 ? "line-through" : ""}`}>
                    {kw.keyword}
                  </span>
                  {kw.usedCount > 0 && <Badge variant="secondary" className="text-xs shrink-0">使用{kw.usedCount}回</Badge>}
                  {!kw.enabled && <Badge variant="destructive" className="text-xs shrink-0">無効</Badge>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-xs">{kw.category || 'なし'}</Badge>
                  <span className="text-xs text-muted-foreground">優先度: {kw.priority}</span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive shrink-0"
              onClick={() => { if (confirm("このキーワードを削除しますか？")) deleteMutation.mutate({ id: kw.id }); }}
            >
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

      {/* Add Keyword Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>キーワード追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>キーワード</Label>
              <Input
                value={newKeyword.keyword}
                onChange={(e) => setNewKeyword(prev => ({ ...prev, keyword: e.target.value }))}
                placeholder="例: TikTok Shop 人気商品 2026"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>カテゴリ</Label>
                <Select value={newKeyword.category} onValueChange={(v) => setNewKeyword(prev => ({ ...prev, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">カスタム</SelectItem>
                    <SelectItem value="TikTok Shop基礎">TikTok Shop基礎</SelectItem>
                    <SelectItem value="TikTok Shop販売">TikTok Shop販売</SelectItem>
                    <SelectItem value="TikTok Shopマーケティング">TikTok Shopマーケティング</SelectItem>
                    <SelectItem value="TikTok Shop運営">TikTok Shop運営</SelectItem>
                    <SelectItem value="EC一般">EC一般</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>優先度 (0-10)</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={newKeyword.priority}
                  onChange={(e) => setNewKeyword(prev => ({ ...prev, priority: parseInt(e.target.value) || 5 }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>キャンセル</Button>
            <Button
              onClick={() => addMutation.mutate(newKeyword)}
              disabled={!newKeyword.keyword || addMutation.isPending}
            >
              {addMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== Execution Logs ====================
function ExecutionLogs() {
  const utils = trpc.useUtils();
  const { data: logs, isLoading } = trpc.autoPost.listLogs.useQuery();

  const recoverMutation = trpc.autoPost.recoverStuck.useMutation({
    onSuccess: (result) => {
      utils.autoPost.listLogs.invalidate();
      toast.success(`${result.recovered}/${result.total} 件をリカバリーしました`);
    },
    onError: (err) => toast.error(err.message),
  });

  const stuckCount = logs?.filter((l: any) => l.status === 'generating' || l.status === 'image_generating').length || 0;

  const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
    completed: { label: "完了", icon: CheckCircle2, color: "text-green-500" },
    failed: { label: "失敗", icon: XCircle, color: "text-red-500" },
    pending: { label: "待機中", icon: Clock, color: "text-yellow-500" },
    generating: { label: "記事生成中", icon: Loader2, color: "text-blue-500" },
    image_generating: { label: "画像生成中", icon: ImageIcon, color: "text-purple-500" },
    publishing: { label: "公開中", icon: FileText, color: "text-orange-500" },
  };

  if (isLoading) {
    return <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">実行履歴</h3>
        {stuckCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => recoverMutation.mutate()}
            disabled={recoverMutation.isPending}
            className="gap-1.5 text-orange-600"
          >
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
                          <Badge variant={log.status === 'completed' ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'} className="text-xs">
                            {config.label}
                          </Badge>
                          {log.keyword && (
                            <span className="text-sm font-medium truncate">{log.keyword}</span>
                          )}
                        </div>
                        {log.errorMessage && (
                          <p className="text-xs text-red-500 mt-1 truncate">{log.errorMessage}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(log.createdAt).toLocaleString('ja-JP')}
                          {log.completedAt && ` → ${new Date(log.completedAt).toLocaleString('ja-JP')}`}
                        </p>
                      </div>
                    </div>
                    {log.articleId && (
                      <Button variant="ghost" size="sm" className="shrink-0 text-xs" asChild>
                        <a href={`/master/blog/edit/${log.articleId}`}>
                          <FileText className="h-3.5 w-3.5 mr-1" />
                          記事
                        </a>
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

// ==================== Main Component ====================
export default function AutoPostAdmin() {
  const [, navigate] = useLocation();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/master/blog")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            AI自動投稿
          </h1>
          <p className="text-sm text-muted-foreground">
            SEO/GEO最適化記事の自動生成・公開スケジューラー
          </p>
        </div>
      </div>

      <DashboardStats />

      <Tabs defaultValue="schedules">
        <TabsList>
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
