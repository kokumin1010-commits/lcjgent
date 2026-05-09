import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Sparkles, Plus, Trash2, Edit, Archive, CheckCircle, Package, TrendingUp, Users } from "lucide-react";

export default function MasterSetSuggestions() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResults, setAiResults] = useState<any[]>([]);
  
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
      setEditingId(null);
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
      setAiResults(data);
      setAiGenerating(false);
      toast.success(`${data.length}件のセット提案をAIが生成しました`);
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
  
  function handleAdoptAiResult(result: any) {
    // AI結果をフォームに反映
    setFormTitle(result.title || "");
    setFormDescription(result.description || "");
    setFormCategory(result.category || "季節");
    setFormPrice(String(result.suggestedPrice || ""));
    setFormItems(
      (result.items || []).map((i: any) => ({
        productName: i.productName || "",
        originalPrice: String(i.originalPrice || ""),
        quantity: String(i.quantity || 1),
      }))
    );
    setShowCreateForm(true);
    toast.info("AI提案をフォームに反映しました。内容を確認して登録してください。");
  }
  
  const suggestions = suggestionsQuery.data || [];
  const adoptions = adoptionsQuery.data || [];
  
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="w-7 h-7 text-purple-400" />
            マスターセット提案
          </h1>
          <p className="text-slate-400 mt-1">ライバーに推奨するセット構成を管理。AIで生成 or 手動で登録</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAiGenerate}
            disabled={aiGenerating}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {aiGenerating ? "AI分析中..." : "AI生成"}
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            手動追加
          </button>
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="text-slate-400 text-sm">アクティブ提案</div>
          <div className="text-2xl font-bold text-cyan-400">{suggestions.filter((s: any) => s.status === "active").length}件</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="text-slate-400 text-sm">総採用数</div>
          <div className="text-2xl font-bold text-green-400">{suggestions.reduce((sum: number, s: any) => sum + (s.adoptionCount || 0), 0)}回</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="text-slate-400 text-sm">今月の採用</div>
          <div className="text-2xl font-bold text-yellow-400">
            {adoptions.filter((a: any) => {
              const d = new Date(a.adoptedAt);
              const now = new Date();
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length}回
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="text-slate-400 text-sm">採用ライバー数</div>
          <div className="text-2xl font-bold text-purple-400">
            {new Set(adoptions.map((a: any) => a.liverId)).size}人
          </div>
        </div>
      </div>
      
      {/* AI Results */}
      {aiResults.length > 0 && (
        <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-700/50 rounded-xl p-6">
          <h3 className="text-lg font-bold text-purple-300 flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5" />
            AI生成結果（{aiResults.length}件）
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {aiResults.map((result, idx) => (
              <div key={idx} className="bg-slate-800/80 border border-purple-600/30 rounded-lg p-4">
                <h4 className="font-bold text-white mb-1">{result.title}</h4>
                <p className="text-sm text-slate-400 mb-2">{result.description}</p>
                <div className="text-sm space-y-1 mb-3">
                  <div className="text-cyan-400">売値: ¥{(result.suggestedPrice || 0).toLocaleString()}</div>
                  <div className="text-green-400">予想販売: {result.expectedSales}セット</div>
                  <div className="text-slate-300">
                    商品: {(result.items || []).map((i: any) => `${i.productName}×${i.quantity || 1}`).join(", ")}
                  </div>
                  {result.reasoning && (
                    <div className="text-xs text-slate-500 mt-2 border-t border-slate-700 pt-2">{result.reasoning}</div>
                  )}
                </div>
                <button
                  onClick={() => handleAdoptAiResult(result)}
                  className="w-full px-3 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                >
                  この提案を登録する
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setAiResults([])}
            className="mt-4 text-sm text-slate-400 hover:text-white"
          >
            結果を閉じる
          </button>
        </div>
      )}
      
      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-slate-800/80 border border-slate-600 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">新規セット提案</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm text-slate-400">セット名 *</label>
              <input
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                placeholder="例: 5月UVケアセット"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400">カテゴリ</label>
              <select
                value={formCategory}
                onChange={e => setFormCategory(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
              >
                <option value="">選択してください</option>
                <option value="季節">季節</option>
                <option value="定番">定番</option>
                <option value="キャンペーン">キャンペーン</option>
                <option value="新商品">新商品</option>
                <option value="在庫処分">在庫処分</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400">推奨売値 (円) *</label>
              <input
                type="number"
                value={formPrice}
                onChange={e => setFormPrice(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                placeholder="5000"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400">優先度 (高い順)</label>
              <input
                type="number"
                value={formPriority}
                onChange={e => setFormPriority(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400">有効開始日</label>
              <input
                type="date"
                value={formValidFrom}
                onChange={e => setFormValidFrom(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400">有効終了日</label>
              <input
                type="date"
                value={formValidUntil}
                onChange={e => setFormValidUntil(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="text-sm text-slate-400">説明・セールスポイント</label>
            <textarea
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
              rows={2}
              placeholder="このセットの魅力を1-2文で"
            />
          </div>
          
          {/* Items */}
          <div className="mb-4">
            <label className="text-sm text-slate-400 mb-2 block">セット商品 *</label>
            {formItems.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input
                  value={item.productName}
                  onChange={e => {
                    const newItems = [...formItems];
                    newItems[idx].productName = e.target.value;
                    setFormItems(newItems);
                  }}
                  className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
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
                  className="w-28 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
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
                  className="w-16 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
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
              className="text-sm text-cyan-400 hover:text-cyan-300"
            >
              + 商品を追加
            </button>
          </div>
          
          {/* Preview */}
          {formPrice && formItems.some(i => i.originalPrice) && (
            <div className="bg-slate-900/50 border border-slate-700 rounded p-3 mb-4">
              <div className="text-sm text-slate-400">プレビュー</div>
              <div className="flex gap-4 mt-1">
                <span className="text-white">
                  元値合計: ¥{formItems.reduce((sum, i) => sum + (Number(i.originalPrice) || 0) * (Number(i.quantity) || 1), 0).toLocaleString()}
                </span>
                <span className="text-cyan-400">
                  売値: ¥{Number(formPrice).toLocaleString()}
                </span>
                <span className="text-green-400">
                  割引率: {Math.round((1 - Number(formPrice) / formItems.reduce((sum, i) => sum + (Number(i.originalPrice) || 0) * (Number(i.quantity) || 1), 0)) * 100)}%OFF
                </span>
              </div>
            </div>
          )}
          
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50"
            >
              {createMutation.isPending ? "登録中..." : "登録する"}
            </button>
            <button onClick={resetForm} className="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-500">
              キャンセル
            </button>
          </div>
        </div>
      )}
      
      {/* Filter */}
      <div className="flex gap-2">
        {["active", "archived", ""].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1.5 rounded text-sm ${
              filterStatus === status
                ? "bg-cyan-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            {status === "active" ? "アクティブ" : status === "archived" ? "アーカイブ" : "すべて"}
          </button>
        ))}
      </div>
      
      {/* Suggestions List */}
      <div className="space-y-4">
        {suggestions.length === 0 ? (
          <div className="text-center text-slate-500 py-12">
            セット提案がありません。AIで生成するか手動で追加してください。
          </div>
        ) : (
          suggestions.map((s: any) => (
            <div key={s.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-white">{s.title}</h3>
                    {s.category && (
                      <span className="px-2 py-0.5 bg-purple-900/50 text-purple-300 text-xs rounded">{s.category}</span>
                    )}
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      s.status === "active" ? "bg-green-900/50 text-green-300" : "bg-slate-700 text-slate-400"
                    }`}>
                      {s.status === "active" ? "公開中" : "アーカイブ"}
                    </span>
                  </div>
                  {s.description && <p className="text-sm text-slate-400 mt-1">{s.description}</p>}
                  
                  <div className="flex flex-wrap gap-4 mt-3 text-sm">
                    <span className="text-cyan-400">売値: ¥{(s.suggestedPrice || 0).toLocaleString()}</span>
                    <span className="text-yellow-400">{s.suggestedDiscountRate}%OFF</span>
                    <span className="text-green-400">予想: {s.expectedSales}セット</span>
                    <span className="text-purple-400 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      採用: {s.adoptionCount || 0}回
                    </span>
                    {s.priority > 0 && <span className="text-orange-400">優先度: {s.priority}</span>}
                  </div>
                  
                  {/* Items */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(s.items || []).map((item: any, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-slate-700/50 text-slate-300 text-xs rounded">
                        {item.productName} ¥{(item.originalPrice || 0).toLocaleString()}
                        {item.quantity > 1 && ` ×${item.quantity}`}
                      </span>
                    ))}
                  </div>
                  
                  {s.aiReasoning && (
                    <div className="mt-2 text-xs text-slate-500 border-t border-slate-700 pt-2">
                      💡 {s.aiReasoning}
                    </div>
                  )}
                </div>
                
                <div className="flex gap-1 ml-4">
                  <button
                    onClick={() => updateMutation.mutate({ id: s.id, status: s.status === "active" ? "archived" : "active" })}
                    className="p-2 text-slate-400 hover:text-yellow-400"
                    title={s.status === "active" ? "アーカイブ" : "公開する"}
                  >
                    {s.status === "active" ? <Archive className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("本当に削除しますか？")) deleteMutation.mutate({ id: s.id });
                    }}
                    className="p-2 text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Recent Adoptions */}
      {adoptions.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-400" />
            最近の採用履歴
          </h3>
          <div className="space-y-2">
            {adoptions.slice(0, 10).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                  <span className="text-white font-medium">{a.liverName || `Liver #${a.liverId}`}</span>
                  <span className="text-slate-400 text-sm">が提案#{a.suggestionId}を採用</span>
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(a.adoptedAt).toLocaleDateString("ja-JP")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
