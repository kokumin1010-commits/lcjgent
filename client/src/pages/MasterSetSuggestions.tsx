import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Sparkles, Plus, Trash2, Archive, CheckCircle, Package, TrendingUp, Users, ChevronDown, ChevronUp, ArrowRight, Calendar, Search, ThumbsUp, ThumbsDown, Star, MessageSquare, BarChart3, Brain, X } from "lucide-react";

export default function MasterSetSuggestions() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showPastSets, setShowPastSets] = useState(false);
  const [pastSetsSortBy, setPastSetsSortBy] = useState<"revenue" | "date">("revenue");
  const [pastSetsSearch, setPastSetsSearch] = useState("");
  const [expandedLiverId, setExpandedLiverId] = useState<number | null>(null);
  const [showPatternAnalysis, setShowPatternAnalysis] = useState(false);
  
  // 却下理由モーダル
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveReason, setApproveReason] = useState("");
  
  // 口コミモーダル
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [showReviewsForId, setShowReviewsForId] = useState<number | null>(null);
  
  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formPriority, setFormPriority] = useState("0");
  const [formValidFrom, setFormValidFrom] = useState("");
  const [formValidUntil, setFormValidUntil] = useState("");
  const [formItems, setFormItems] = useState<{productName: string; originalPrice: string; quantity: string}[]>([
    { productName: "", originalPrice: "", quantity: "1" }
  ]);
  
  const suggestionsQuery = trpc.masterSetSuggestion.list.useQuery({ status: filterStatus || undefined });
  const adoptionsQuery = trpc.masterSetSuggestion.adoptions.useQuery();
  const performanceQuery = trpc.masterSetSuggestion.performanceMetrics.useQuery();
  const feedbackQuery = trpc.masterSetSuggestion.feedbackList.useQuery();
  const reviewsQuery = trpc.masterSetSuggestion.reviews.useQuery();
  const patternQuery = trpc.masterSetSuggestion.patternAnalysis.useQuery(undefined, { enabled: showPatternAnalysis });
  
  const autoLinkMutation = trpc.masterSetSuggestion.autoLinkResults.useMutation({
    onSuccess: (data) => {
      if (data.linked > 0) {
        toast.success(`${data.linked}件の採用を実績と紐付けました`);
        performanceQuery.refetch();
        adoptionsQuery.refetch();
      } else {
        toast.info("新たに紐付けできる採用はありませんでした");
      }
    },
    onError: (e) => toast.error(e.message),
  });
  
  const approveMutation = trpc.masterSetSuggestion.approve.useMutation({
    onSuccess: () => {
      toast.success("提案を承認しました（ライバーに公開されます）");
      suggestionsQuery.refetch();
      feedbackQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  
  const rejectMutation = trpc.masterSetSuggestion.reject.useMutation({
    onSuccess: () => {
      toast.success("提案を却下しました（フィードバックが記録されました）");
      suggestionsQuery.refetch();
      feedbackQuery.refetch();
      setRejectingId(null);
      setRejectReason("");
    },
    onError: (e) => toast.error(e.message),
  });
  
  const addReviewMutation = trpc.masterSetSuggestion.addReview.useMutation({
    onSuccess: () => {
      toast.success("口コミを投稿しました");
      reviewsQuery.refetch();
      setReviewingId(null);
      setReviewRating(5);
      setReviewComment("");
    },
    onError: (e) => toast.error(e.message),
  });
  
  // 過去の全セット実績データ
  const allLiversQuery = trpc.livestreamSets.allLiversSetAnalysis.useQuery();
  const liverSetQuery = trpc.livestreamSets.liverSetAnalysis.useQuery(
    { liverId: expandedLiverId! },
    { enabled: expandedLiverId !== null }
  );
  
  const createMutation = trpc.masterSetSuggestion.create.useMutation({
    onSuccess: () => {
      toast.success("セット提案を作成しました");
      suggestionsQuery.refetch();
      resetForm();
    },
    onError: (e) => toast.error(e.message),
  });
  
  const updateMutation = trpc.masterSetSuggestion.update.useMutation({
    onSuccess: () => {
      toast.success("更新しました");
      suggestionsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  
  const deleteMutation = trpc.masterSetSuggestion.delete.useMutation({
    onSuccess: () => {
      toast.success("削除しました");
      suggestionsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  
  const aiGenerateMutation = trpc.masterSetSuggestion.aiGenerate.useMutation({
    onSuccess: (data) => {
      setAiGenerating(false);
      toast.success(`${data.length}件のセット提案をAIが生成・自動登録しました（承認待ち）`);
      suggestionsQuery.refetch();
    },
    onError: (e) => {
      setAiGenerating(false);
      toast.error(e.message);
    },
  });
  
  function resetForm() {
    setShowCreateForm(false);
    setFormTitle("");
    setFormDescription("");
    setFormCategory("");
    setFormPrice("");
    setFormPriority("0");
    setFormValidFrom("");
    setFormValidUntil("");
    setFormItems([{ productName: "", originalPrice: "", quantity: "1" }]);
  }
  
  function handleCreate() {
    const items = formItems.filter(i => i.productName && i.originalPrice).map(i => ({
      productName: i.productName,
      originalPrice: Number(i.originalPrice),
      quantity: Number(i.quantity) || 1,
    }));
    
    if (!formTitle || !formPrice || items.length === 0) {
      toast.error("セット名、売値、商品を入力してください");
      return;
    }
    
    createMutation.mutate({
      title: formTitle,
      description: formDescription || undefined,
      category: formCategory || undefined,
      suggestedPrice: Number(formPrice),
      priority: Number(formPriority) || 0,
      validFrom: formValidFrom || undefined,
      validUntil: formValidUntil || undefined,
      items,
    });
  }
  
  function handleAiGenerate() {
    setAiGenerating(true);
    aiGenerateMutation.mutate({});
  }
  
  // 過去のセットを提案に追加
  function handleAddFromPastSet(set: any) {
    setFormTitle(set.setName || "");
    setFormDescription(`過去実績: ${set.quantitySold || 0}セット販売 / 売上¥${Number(set.totalRevenue || 0).toLocaleString()}`);
    setFormCategory("定番");
    setFormPrice(String(set.setPrice || ""));
    setFormItems(
      (set.items || []).map((i: any) => ({
        productName: i.productName || "",
        originalPrice: String(i.price || ""),
        quantity: String(i.quantity || 1),
      }))
    );
    setShowCreateForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.info("過去セットをフォームに反映しました。内容を確認して登録してください。");
  }
  
  const suggestions = suggestionsQuery.data || [];
  const adoptions = adoptionsQuery.data || [];
  const performanceMetrics = performanceQuery.data || [];
  const allFeedback = feedbackQuery.data || [];
  const allReviews = reviewsQuery.data || [];
  
  // 提案ごとの効果測定データをマップ化
  const performanceMap = new Map(performanceMetrics.map((p: any) => [p.suggestionId, p]));
  // 提案ごとの口コミをマップ化
  const reviewsByIdMap = new Map<number, any[]>();
  for (const r of allReviews) {
    const list = reviewsByIdMap.get(r.suggestionId) || [];
    list.push(r);
    reviewsByIdMap.set(r.suggestionId, list);
  }
  
  // APIがbigintを文字列で返すためNumber()で変換
  const allLivers = (allLiversQuery.data || []).map((l: any) => ({
    ...l,
    totalSetRevenue: Number(l.totalSetRevenue) || 0,
    totalQuantitySold: Number(l.totalQuantitySold) || 0,
    avgDiscountRate: Number(l.avgDiscountRate) || 0,
  }));
  const liverSets = liverSetQuery.data;
  
  // 過去セットのソート
  const sortedLiverSets = liverSets?.sets ? [...liverSets.sets].sort((a: any, b: any) => {
    if (pastSetsSortBy === "date") {
      return new Date(b.livestreamDate || 0).getTime() - new Date(a.livestreamDate || 0).getTime();
    }
    return Number(b.totalRevenue || 0) - Number(a.totalRevenue || 0);
  }).filter((s: any) => {
    if (!pastSetsSearch) return true;
    const search = pastSetsSearch.toLowerCase();
    return (s.setName || "").toLowerCase().includes(search) ||
      (s.items || []).some((i: any) => (i.productName || "").toLowerCase().includes(search));
  }) : [];
  
  // 統計
  const pendingCount = suggestions.filter((s: any) => s.status === "pending").length;
  const activeCount = suggestions.filter((s: any) => s.status === "active").length;
  const rejectedCount = allFeedback.filter((f: any) => f.action === "rejected").length;
  const approvedCount = allFeedback.filter((f: any) => f.action === "approved").length;
  
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="w-7 h-7 text-purple-400" />
            マスターセット提案
          </h1>
          <p className="text-slate-400 mt-1">AIが生成 → 管理者が承認/却下 → ライバーに公開 → フィードバックでAI学習</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPatternAnalysis(!showPatternAnalysis)}
            className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 flex items-center gap-2 font-medium"
          >
            <Brain className="w-4 h-4" />
            AI学習分析
          </button>
          <button
            onClick={handleAiGenerate}
            disabled={aiGenerating}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2 font-medium"
          >
            <Sparkles className="w-4 h-4" />
            {aiGenerating ? "AI生成中..." : "AI生成"}
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 flex items-center gap-2 font-medium"
          >
            <Plus className="w-4 h-4" />
            手動追加
          </button>
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3">
          <div className="text-slate-400 text-xs font-medium">承認待ち</div>
          <div className="text-xl font-bold text-orange-400 mt-0.5">{pendingCount}件</div>
        </div>
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3">
          <div className="text-slate-400 text-xs font-medium">公開中</div>
          <div className="text-xl font-bold text-green-400 mt-0.5">{activeCount}件</div>
        </div>
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3">
          <div className="text-slate-400 text-xs font-medium">承認/却下</div>
          <div className="text-xl font-bold text-cyan-400 mt-0.5">
            <span className="text-green-400">{approvedCount}</span>
            <span className="text-slate-500 mx-1">/</span>
            <span className="text-red-400">{rejectedCount}</span>
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3">
          <div className="text-slate-400 text-xs font-medium">総採用数</div>
          <div className="text-xl font-bold text-purple-400 mt-0.5">{adoptions.length}回</div>
        </div>
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3">
          <div className="text-slate-400 text-xs font-medium">採用後売上</div>
          <div className="text-xl font-bold text-amber-400 mt-0.5">
            ¥{performanceMetrics.reduce((sum: number, p: any) => sum + Number(p.totalActualRevenue || 0), 0).toLocaleString()}
          </div>
          <button
            onClick={() => autoLinkMutation.mutate()}
            disabled={autoLinkMutation.isPending}
            className="mt-1 text-[10px] text-cyan-400 hover:text-cyan-300 underline disabled:opacity-50"
          >
            {autoLinkMutation.isPending ? "紐付中..." : "↔ 自動紐付"}
          </button>
        </div>
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3">
          <div className="text-slate-400 text-xs font-medium">口コミ数</div>
          <div className="text-xl font-bold text-pink-400 mt-0.5">{allReviews.length}件</div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            平均{allReviews.length > 0 ? (allReviews.reduce((s: number, r: any) => s + Number(r.rating || 0), 0) / allReviews.length).toFixed(1) : '-'}★
          </div>
        </div>
      </div>
      
      {/* Phase 3: パターン分析ダッシュボード */}
      {showPatternAnalysis && (
        <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-500/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-indigo-200 flex items-center gap-2">
              <Brain className="w-5 h-5" />
              AI学習分析ダッシュボード
            </h3>
            <button onClick={() => setShowPatternAnalysis(false)} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {patternQuery.isLoading ? (
            <div className="text-center text-slate-400 py-8">分析データを読み込み中...</div>
          ) : patternQuery.data ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* カテゴリ別フィードバック */}
              <div className="bg-slate-800/60 rounded-lg p-4">
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-400" />
                  カテゴリ別フィードバック
                </h4>
                {((patternQuery.data as any).categoryStats || []).length === 0 ? (
                  <p className="text-slate-400 text-sm">まだフィードバックデータがありません。提案を承認/却下するとデータが蓄積されます。</p>
                ) : (
                  <div className="space-y-2">
                    {((patternQuery.data as any).categoryStats || []).map((stat: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            stat.action === 'rejected' ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'
                          }`}>
                            {stat.action === 'rejected' ? '却下' : '承認'}
                          </span>
                          <span className="text-slate-200">{stat.category || '未分類'}</span>
                        </div>
                        <span className="text-slate-300 font-medium">{stat.count}件</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* キーワード頻度 */}
              <div className="bg-slate-800/60 rounded-lg p-4">
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-pink-400" />
                  頻出キーワード（AI学習済み）
                </h4>
                {((patternQuery.data as any).keywordFrequency || []).length === 0 ? (
                  <p className="text-slate-400 text-sm">キーワードデータがまだありません。フィードバックが蓄積されるとAIが自動分類します。</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {((patternQuery.data as any).keywordFrequency || []).map((kw: any, idx: number) => (
                      <span key={idx} className={`px-2 py-1 rounded text-xs font-medium ${
                        kw.rejected > kw.approved
                          ? 'bg-red-900/40 text-red-300 border border-red-700/30'
                          : 'bg-green-900/40 text-green-300 border border-green-700/30'
                      }`}>
                        {kw.keyword} ({kw.total})
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              {/* 口コミ傾向 */}
              <div className="bg-slate-800/60 rounded-lg p-4">
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  口コミ傾向分析
                </h4>
                {((patternQuery.data as any).reviewStats || []).length === 0 ? (
                  <p className="text-slate-400 text-sm">口コミデータがまだありません。ライバーが口コミを投稿するとデータが蓄積されます。</p>
                ) : (
                  <div className="space-y-2">
                    {((patternQuery.data as any).reviewStats || []).map((stat: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-slate-200">{stat.category || '未分類'}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-yellow-300">★{Number(stat.avg_rating || 0).toFixed(1)}</span>
                          <span className="text-green-300 text-xs">👍{stat.positive_count || 0}</span>
                          <span className="text-red-300 text-xs">👎{stat.negative_count || 0}</span>
                          <span className="text-slate-400 text-xs">{stat.count}件</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* 最近の却下理由 */}
              <div className="bg-slate-800/60 rounded-lg p-4">
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <ThumbsDown className="w-4 h-4 text-red-400" />
                  最近の却下理由（次回AI生成に反映）
                </h4>
                {((patternQuery.data as any).recentRejections || []).length === 0 ? (
                  <p className="text-slate-400 text-sm">却下履歴がまだありません。</p>
                ) : (
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {((patternQuery.data as any).recentRejections || []).slice(0, 10).map((rej: any, idx: number) => (
                      <div key={idx} className="text-xs flex items-start gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          rej.category ? 'bg-red-900/40 text-red-300' : 'bg-slate-700 text-slate-400'
                        }`}>
                          {rej.category || '未分類'}
                        </span>
                        <span className="text-slate-300 flex-1">{rej.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
          
          <div className="mt-4 text-xs text-slate-400 bg-slate-800/40 rounded-lg p-3">
            <strong className="text-indigo-300">AI学習フロー:</strong> 管理者が承認/却下 → AIが理由を自動分類（カテゴリ・キーワード・感情） → 次回AI生成時に過去のフィードバックをプロンプトに反映 → 精度向上
          </div>
        </div>
      )}
      
      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-slate-800 border border-cyan-600/50 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">新規セット提案</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm text-slate-300 font-medium">セット名 *</label>
              <input
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-500 rounded text-white placeholder-slate-400"
                placeholder="例: 春の紫外線ケアセット"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300 font-medium">カテゴリ</label>
              <select
                value={formCategory}
                onChange={e => setFormCategory(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-500 rounded text-white"
              >
                <option value="">選択してください</option>
                <option value="季節">季節</option>
                <option value="定番">定番</option>
                <option value="キャンペーン">キャンペーン</option>
                <option value="新商品">新商品</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-slate-300 font-medium">説明</label>
              <textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-500 rounded text-white placeholder-slate-400"
                placeholder="セールスポイントなど"
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm text-slate-300 font-medium">売値 *</label>
              <input
                type="number"
                value={formPrice}
                onChange={e => setFormPrice(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-500 rounded text-white placeholder-slate-400"
                placeholder="例: 9980"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300 font-medium">優先度</label>
              <input
                type="number"
                value={formPriority}
                onChange={e => setFormPriority(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-500 rounded text-white placeholder-slate-400"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300 font-medium">有効開始日</label>
              <input
                type="date"
                value={formValidFrom}
                onChange={e => setFormValidFrom(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-500 rounded text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300 font-medium">有効終了日</label>
              <input
                type="date"
                value={formValidUntil}
                onChange={e => setFormValidUntil(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-500 rounded text-white"
              />
            </div>
          </div>
          
          {/* Items */}
          <div className="mb-4">
            <label className="text-sm text-slate-300 font-medium mb-2 block">セット商品 *</label>
            {formItems.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input
                  value={item.productName}
                  onChange={e => {
                    const newItems = [...formItems];
                    newItems[idx].productName = e.target.value;
                    setFormItems(newItems);
                  }}
                  className="flex-1 px-3 py-2 bg-slate-700 border border-slate-500 rounded text-white text-sm placeholder-slate-400"
                  placeholder="商品名"
                />
                <input
                  type="number"
                  value={item.originalPrice}
                  onChange={e => {
                    const newItems = [...formItems];
                    newItems[idx].originalPrice = e.target.value;
                    setFormItems(newItems);
                  }}
                  className="w-28 px-3 py-2 bg-slate-700 border border-slate-500 rounded text-white text-sm placeholder-slate-400"
                  placeholder="元値"
                />
                <input
                  type="number"
                  value={item.quantity}
                  onChange={e => {
                    const newItems = [...formItems];
                    newItems[idx].quantity = e.target.value;
                    setFormItems(newItems);
                  }}
                  className="w-16 px-3 py-2 bg-slate-700 border border-slate-500 rounded text-white text-sm placeholder-slate-400"
                  placeholder="数量"
                />
                {formItems.length > 1 && (
                  <button
                    onClick={() => setFormItems(formItems.filter((_, i) => i !== idx))}
                    className="px-2 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => setFormItems([...formItems, { productName: "", originalPrice: "", quantity: "1" }])}
              className="text-sm text-cyan-400 hover:text-cyan-300 font-medium"
            >
              + 商品を追加
            </button>
          </div>
          
          {/* Preview */}
          {formPrice && formItems.some(i => i.originalPrice) && (
            <div className="bg-slate-900 border border-slate-600 rounded p-3 mb-4">
              <div className="text-sm text-slate-300 font-medium">プレビュー</div>
              <div className="flex gap-4 mt-1">
                <span className="text-white">
                  元値合計: ¥{formItems.reduce((sum, i) => sum + (Number(i.originalPrice) || 0) * (Number(i.quantity) || 1), 0).toLocaleString()}
                </span>
                <span className="text-cyan-400 font-bold">
                  売値: ¥{Number(formPrice).toLocaleString()}
                </span>
                <span className="text-green-400 font-bold">
                  割引率: {Math.round((1 - Number(formPrice) / formItems.reduce((sum, i) => sum + (Number(i.originalPrice) || 0) * (Number(i.quantity) || 1), 0)) * 100)}%OFF
                </span>
              </div>
            </div>
          )}
          
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-cyan-600 text-white rounded font-medium hover:bg-cyan-700 disabled:opacity-50"
            >
              {createMutation.isPending ? "登録中..." : "登録する"}
            </button>
            <button onClick={resetForm} className="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-500">
              キャンセル
            </button>
          </div>
        </div>
      )}
      
      {/* Filter - pending/active/rejected/archived/all */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: "pending", label: "承認待ち", color: "orange" },
          { value: "active", label: "公開中", color: "green" },
          { value: "rejected", label: "却下済み", color: "red" },
          { value: "archived", label: "アーカイブ", color: "slate" },
          { value: "", label: "すべて", color: "slate" },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilterStatus(value)}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              filterStatus === value
                ? "bg-cyan-600 text-white"
                : "bg-slate-700 text-slate-200 hover:bg-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      
      {/* Suggestions List */}
      <div className="space-y-4">
        {suggestions.length === 0 ? (
          <div className="text-center text-slate-400 py-12">
            {filterStatus === "pending" 
              ? "承認待ちの提案はありません。「AI生成」ボタンで提案を自動生成できます。"
              : "セット提案がありません。AIで生成するか手動で追加してください。"}
          </div>
        ) : (
          suggestions.map((s: any) => {
            const reviews = reviewsByIdMap.get(s.id) || [];
            const avgRating = reviews.length > 0 ? reviews.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0) / reviews.length : 0;
            
            return (
            <div key={s.id} className={`bg-slate-800 border rounded-xl p-5 hover:border-slate-500 transition ${
              s.status === 'pending' ? 'border-orange-500/50' :
              s.status === 'rejected' ? 'border-red-500/30' :
              s.status === 'active' ? 'border-green-500/30' :
              'border-slate-600'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-bold text-white">{s.title}</h3>
                    {s.category && (
                      <span className="px-2 py-0.5 bg-purple-800 text-purple-200 text-xs rounded font-medium">{s.category}</span>
                    )}
                    <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                      s.status === "active" ? "bg-green-800 text-green-200" :
                      s.status === "pending" ? "bg-orange-800 text-orange-200" :
                      s.status === "rejected" ? "bg-red-800 text-red-200" :
                      "bg-slate-600 text-slate-300"
                    }`}>
                      {s.status === "active" ? "公開中" : s.status === "pending" ? "承認待ち" : s.status === "rejected" ? "却下済み" : "アーカイブ"}
                    </span>
                    {reviews.length > 0 && (
                      <button
                        onClick={() => setShowReviewsForId(showReviewsForId === s.id ? null : s.id)}
                        className="flex items-center gap-1 text-xs text-yellow-300 hover:text-yellow-200"
                      >
                        <Star className="w-3 h-3 fill-yellow-400" />
                        {avgRating.toFixed(1)} ({reviews.length})
                      </button>
                    )}
                  </div>
                  {s.description && <p className="text-sm text-slate-300 mt-1">{s.description}</p>}
                  
                  <div className="flex flex-wrap gap-4 mt-3 text-sm">
                    <span className="text-slate-400 line-through">元値: ¥{(s.items || []).reduce((sum: number, i: any) => sum + Number(i.originalPrice || 0) * Number(i.quantity || 1), 0).toLocaleString()}</span>
                    <span className="text-cyan-300 font-bold">売値: ¥{Number(s.suggestedPrice || 0).toLocaleString()}</span>
                    <span className="text-yellow-300 font-bold">{s.suggestedDiscountRate}%OFF</span>
                    {s.expectedSales > 0 && <span className="text-green-300">予想: {s.expectedSales}セット</span>}
                    <span className="text-purple-300 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      採用: {s.adoptionCount || 0}回
                    </span>
                  </div>
                  
                  {/* 効果測定データ */}
                  {performanceMap.has(s.id) && (() => {
                    const perf = performanceMap.get(s.id);
                    const avgRevenue = Number(perf.avgActualRevenue || 0);
                    const totalRevenue = Number(perf.totalActualRevenue || 0);
                    const linkedCount = Number(perf.linkedCount || 0);
                    if (linkedCount === 0) return null;
                    return (
                      <div className="mt-2 flex flex-wrap gap-3 text-xs bg-emerald-900/20 border border-emerald-700/30 rounded-lg px-3 py-2">
                        <span className="text-emerald-300 font-medium flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          実売上: ¥{totalRevenue.toLocaleString()}
                        </span>
                        <span className="text-emerald-200">平均: ¥{Math.round(avgRevenue).toLocaleString()}/採用</span>
                        <span className="text-emerald-200">紐付: {linkedCount}/{Number(perf.adoptionCount || 0)}件</span>
                      </div>
                    );
                  })()}
                  
                  {/* Items */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(s.items || []).map((item: any, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-slate-700 text-slate-200 text-xs rounded font-medium">
                        {item.productName} ¥{Number(item.originalPrice || 0).toLocaleString()}
                        {item.quantity > 1 && ` ×${item.quantity}`}
                      </span>
                    ))}
                  </div>
                  
                  {s.aiReasoning && (
                    <div className="mt-2 text-xs text-slate-400 border-t border-slate-600 pt-2">
                      💡 {s.aiReasoning}
                    </div>
                  )}
                  
                  {/* 口コミ表示 */}
                  {showReviewsForId === s.id && reviews.length > 0 && (
                    <div className="mt-3 bg-slate-900/50 border border-slate-700 rounded-lg p-3">
                      <h5 className="text-xs font-bold text-white mb-2 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        口コミ ({reviews.length}件)
                      </h5>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {reviews.map((r: any) => (
                          <div key={r.id} className="text-xs border-b border-slate-700 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-yellow-300">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                              <span className="text-slate-300">{r.liverName || `Liver#${r.liverId}`}</span>
                              {r.category && <span className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px]">{r.category}</span>}
                              {r.sentiment && <span className={`text-[10px] ${r.sentiment === 'positive' ? 'text-green-400' : r.sentiment === 'negative' ? 'text-red-400' : 'text-slate-400'}`}>
                                {r.sentiment === 'positive' ? '😊' : r.sentiment === 'negative' ? '😞' : '😐'}
                              </span>}
                            </div>
                            {r.comment && <p className="text-slate-300 mt-1">{r.comment}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col gap-1 ml-4">
                  {/* Phase 1: 承認/却下ボタン */}
                  {s.status === "pending" && (
                    <>
                      <button
                        onClick={() => {
                          const reason = prompt("承認理由（任意）:");
                          approveMutation.mutate({ suggestionId: s.id, reason: reason || undefined });
                        }}
                        disabled={approveMutation.isPending}
                        className="p-2 bg-green-600/20 text-green-400 hover:bg-green-600/40 rounded-lg transition"
                        title="承認（ライバーに公開）"
                      >
                        <ThumbsUp className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => { setRejectingId(s.id); setRejectReason(""); }}
                        className="p-2 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded-lg transition"
                        title="却下"
                      >
                        <ThumbsDown className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  
                  {/* 口コミ追加 */}
                  {s.status === "active" && (
                    <button
                      onClick={() => { setReviewingId(s.id); setReviewRating(5); setReviewComment(""); }}
                      className="p-2 text-yellow-400 hover:bg-yellow-600/20 rounded-lg transition"
                      title="口コミを追加"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  
                  {/* ステータス変更 */}
                  {s.status !== "pending" && (
                    <button
                      onClick={() => updateMutation.mutate({ id: s.id, status: s.status === "active" ? "archived" : "active" })}
                      className="p-2 text-slate-300 hover:text-yellow-300"
                      title={s.status === "active" ? "アーカイブ" : "公開する"}
                    >
                      {s.status === "active" ? <Archive className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm("本当に削除しますか？")) deleteMutation.mutate({ id: s.id });
                    }}
                    className="p-2 text-slate-300 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>
      
      {/* 却下理由モーダル */}
      {rejectingId !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setRejectingId(null)}>
          <div className="bg-slate-800 border border-red-500/50 rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <ThumbsDown className="w-5 h-5 text-red-400" />
              却下理由を入力
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              この理由はAIが学習し、次回の提案生成に反映されます。具体的に書くほどAIの精度が向上します。
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-500 rounded text-white placeholder-slate-400 mb-2"
              placeholder="例: 割引率が低すぎて魅力がない / 夏なのに保湿セットは季節外れ / この商品は在庫が少ない"
              rows={3}
              autoFocus
            />
            <div className="flex flex-wrap gap-2 mb-4">
              {["割引率が低い", "季節に合わない", "商品の組み合わせが悪い", "価格が高すぎ", "在庫不足", "売れない商品が含まれている"].map(reason => (
                <button
                  key={reason}
                  onClick={() => setRejectReason(prev => prev ? `${prev}、${reason}` : reason)}
                  className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded hover:bg-slate-600 border border-slate-600"
                >
                  {reason}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!rejectReason.trim()) {
                    toast.error("却下理由を入力してください");
                    return;
                  }
                  rejectMutation.mutate({ suggestionId: rejectingId, reason: rejectReason });
                }}
                disabled={rejectMutation.isPending || !rejectReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {rejectMutation.isPending ? "処理中..." : "却下する"}
              </button>
              <button
                onClick={() => setRejectingId(null)}
                className="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-500"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 口コミ投稿モーダル */}
      {reviewingId !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setReviewingId(null)}>
          <div className="bg-slate-800 border border-yellow-500/50 rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              口コミを投稿
            </h3>
            <div className="mb-4">
              <label className="text-sm text-slate-300 font-medium block mb-2">評価</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setReviewRating(n)}
                    className={`text-2xl transition ${n <= reviewRating ? 'text-yellow-400' : 'text-slate-600'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="text-sm text-slate-300 font-medium block mb-1">コメント</label>
              <textarea
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-500 rounded text-white placeholder-slate-400"
                placeholder="このセットについてのコメント..."
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  addReviewMutation.mutate({
                    suggestionId: reviewingId,
                    liverId: 0,
                    liverName: "管理者",
                    rating: reviewRating,
                    comment: reviewComment || undefined,
                  });
                }}
                disabled={addReviewMutation.isPending}
                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded font-medium hover:bg-yellow-700 disabled:opacity-50"
              >
                {addReviewMutation.isPending ? "投稿中..." : "投稿する"}
              </button>
              <button
                onClick={() => setReviewingId(null)}
                className="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-500"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Recent Adoptions */}
      {adoptions.length > 0 && (
        <div className="bg-slate-800 border border-slate-600 rounded-xl p-5">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-400" />
            最近の採用履歴
          </h3>
          <div className="space-y-2">
            {adoptions.slice(0, 10).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-slate-700">
                <div className="flex items-center gap-3">
                  <span className="text-white font-medium">{a.liverName || `Liver #${a.liverId}`}</span>
                  <span className="text-slate-300 text-sm">が提案#{a.suggestionId}を採用</span>
                  {Number(a.actualRevenue) > 0 && (
                    <span className="px-2 py-0.5 bg-emerald-900/40 text-emerald-300 text-xs rounded font-medium">
                      売上¥{Number(a.actualRevenue).toLocaleString()} / {a.actualSales || 0}セット
                    </span>
                  )}
                  {!a.actualRevenue && (
                    <span className="px-2 py-0.5 bg-slate-700 text-slate-400 text-xs rounded">未紐付</span>
                  )}
                </div>
                <span className="text-sm text-slate-400">
                  {new Date(a.adoptedAt).toLocaleDateString("ja-JP")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* ===== 過去の全セット実績 ===== */}
      <div className="border-t border-slate-600 pt-6">
        <button
          onClick={() => setShowPastSets(!showPastSets)}
          className="w-full flex items-center justify-between bg-slate-800 border border-slate-600 rounded-xl p-5 hover:border-slate-500 transition"
        >
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-amber-400" />
            <div className="text-left">
              <h3 className="text-lg font-bold text-white">過去の全セット実績</h3>
              <p className="text-sm text-slate-400">全ライバーのセット実績から「提案に追加」できます</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-amber-300 font-medium">
              {allLivers.length}人 / 合計¥{allLivers.reduce((sum: number, l: any) => sum + Number(l.totalSetRevenue || 0), 0).toLocaleString()}
            </span>
            {showPastSets ? <ChevronUp className="w-5 h-5 text-slate-300" /> : <ChevronDown className="w-5 h-5 text-slate-300" />}
          </div>
        </button>
        
        {showPastSets && (
          <div className="mt-4 space-y-3">
            {allLivers.map((liver: any) => (
              <div key={liver.liverId} className="bg-slate-800/80 border border-slate-600 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedLiverId(expandedLiverId === liver.liverId ? null : liver.liverId)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-700/50 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-white font-bold text-base">{liver.streamerName}</span>
                    <span className="text-xs text-slate-400">{liver.totalSets}セット</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-cyan-300 font-medium">¥{(liver.totalSetRevenue || 0).toLocaleString()}</span>
                    <span className="text-green-300">{liver.totalQuantitySold}個販売</span>
                    <span className="text-yellow-300">{Math.round(liver.avgDiscountRate || 0)}%OFF</span>
                    {expandedLiverId === liver.liverId ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
                  </div>
                </button>
                
                {expandedLiverId === liver.liverId && (
                  <div className="border-t border-slate-700 p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setPastSetsSortBy("revenue")}
                          className={`px-2 py-1 rounded text-xs font-medium ${pastSetsSortBy === "revenue" ? "bg-cyan-600 text-white" : "bg-slate-700 text-slate-300"}`}
                        >
                          売上順
                        </button>
                        <button
                          onClick={() => setPastSetsSortBy("date")}
                          className={`px-2 py-1 rounded text-xs font-medium ${pastSetsSortBy === "date" ? "bg-cyan-600 text-white" : "bg-slate-700 text-slate-300"}`}
                        >
                          新着順
                        </button>
                      </div>
                      <div className="flex-1 relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                        <input
                          value={pastSetsSearch}
                          onChange={e => setPastSetsSearch(e.target.value)}
                          className="w-full pl-7 pr-3 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white placeholder-slate-400"
                          placeholder="セット名・商品名で検索..."
                        />
                      </div>
                    </div>
                    
                    {liverSetQuery.isLoading ? (
                      <div className="text-center text-slate-400 py-4">読み込み中...</div>
                    ) : sortedLiverSets.length === 0 ? (
                      <div className="text-center text-slate-400 py-4">セットデータがありません</div>
                    ) : (
                      <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {sortedLiverSets.map((set: any) => {
                          const dateStr = set.livestreamDate ? new Date(set.livestreamDate).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }) : "";
                          const totalOriginalPrice = (set.items || []).reduce((sum: number, i: any) => sum + Number(i.price || i.originalPrice || 0) * Number(i.quantity || 1), 0);
                          return (
                            <div key={set.id} className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 hover:border-slate-500 transition">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-white font-bold text-sm">{set.setName}</span>
                                    {set.discountRate > 0 && (
                                      <span className="px-2 py-0.5 bg-green-900/60 text-green-300 text-xs rounded font-medium">{Math.round(set.discountRate)}%OFF</span>
                                    )}
                                    {dateStr && <span className="text-slate-500 text-xs">{dateStr}</span>}
                                  </div>
                                  <div className="flex items-center gap-4 mt-2 text-sm">
                                    {totalOriginalPrice > 0 && (
                                      <span className="text-slate-400 line-through">元値¥{totalOriginalPrice.toLocaleString()}</span>
                                    )}
                                    <span className="text-cyan-300 font-bold">売値¥{Number(set.setPrice || 0).toLocaleString()}</span>
                                    <span className="text-green-300 font-medium">{set.quantitySold || 0}セット販売</span>
                                    <span className="text-amber-300">売上¥{Number(set.totalRevenue || 0).toLocaleString()}</span>
                                  </div>
                                  <div className="mt-2 space-y-0.5">
                                    {(set.items || []).map((item: any, idx: number) => (
                                      <div key={idx} className="flex items-center gap-2 text-xs">
                                        <span className="text-slate-300">{item.productName}{(item.quantity || 1) > 1 ? ` ×${item.quantity}` : ''}</span>
                                        {Number(item.price || item.originalPrice || 0) > 0 && (
                                          <span className="text-slate-500">¥{Number(item.price || item.originalPrice || 0).toLocaleString()}</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleAddFromPastSet(set)}
                                  className="ml-3 px-3 py-2 bg-amber-600 text-white text-xs rounded-lg font-medium hover:bg-amber-700 whitespace-nowrap flex items-center gap-1"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                  提案に追加
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
