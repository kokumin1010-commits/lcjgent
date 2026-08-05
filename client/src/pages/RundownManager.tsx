import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Edit, Copy, Search, Upload, ArrowUp, ArrowDown,
  Calendar, Clock, Video, CheckCircle2, FileSpreadsheet, BarChart3,
  GripVertical, Package, AlertCircle
} from "lucide-react";

// ============ SESSION LIST ============
function SessionList({ onSelect }: { onSelect: (id: number) => void }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [filterLiver, setFilterLiver] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const sessionsQuery = trpc.rundown.getSessions.useQuery({
    liverId: filterLiver ? Number(filterLiver) : undefined,
    status: filterStatus || undefined,
  });
  const liversQuery = trpc.rundown.getLivers.useQuery();
  const createMutation = trpc.rundown.createSession.useMutation({
    onSuccess: (data) => {
      toast({ title: "作成完了", description: "新しいRundownを作成しました" });
      sessionsQuery.refetch();
      setShowCreate(false);
      onSelect(data.id);
    },
  });
  const deleteMutation = trpc.rundown.deleteSession.useMutation({
    onSuccess: () => { toast({ title: "削除完了" }); sessionsQuery.refetch(); },
  });
  const duplicateMutation = trpc.rundown.duplicateSession.useMutation({
    onSuccess: (data) => { toast({ title: "複製完了" }); sessionsQuery.refetch(); onSelect(data.id); },
  });

  const [form, setForm] = useState({
    title: "", liverId: "", liverName: "", liveDate: new Date().toISOString().split("T")[0],
    startTime: "20:30", endTime: "22:30", platform: "TikTok", theme: "", operatorName: "", shopName: "LCJ店舗",
  });

  const handleCreate = () => {
    if (!form.title || !form.liveDate) { toast({ title: "エラー", description: "タイトルと日付は必須です", variant: "destructive" }); return; }
    createMutation.mutate({
      ...form,
      liverId: form.liverId ? Number(form.liverId) : undefined,
      liverName: form.liverName || undefined,
    });
  };

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    ready: "bg-blue-100 text-blue-700",
    live: "bg-red-100 text-red-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-yellow-100 text-yellow-700",
  };
  const statusLabels: Record<string, string> = {
    draft: "下書き", ready: "準備完了", live: "配信中", completed: "完了", cancelled: "キャンセル",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6" />
          配信Rundown管理
        </h1>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> 新規作成
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterLiver} onValueChange={setFilterLiver}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="ライバー絞込" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全て</SelectItem>
            {(liversQuery.data || []).map((l: any) => (
              <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="ステータス" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全て</SelectItem>
            <SelectItem value="draft">下書き</SelectItem>
            <SelectItem value="ready">準備完了</SelectItem>
            <SelectItem value="live">配信中</SelectItem>
            <SelectItem value="completed">完了</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Session cards */}
      <div className="grid gap-3">
        {(sessionsQuery.data?.sessions || []).map((s: any) => (
          <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onSelect(s.id)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base">{s.title}</h3>
                      <Badge className={statusColors[s.status] || ""}>{statusLabels[s.status] || s.status}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{s.liveDate?.split("T")[0]}</span>
                      {s.startTime && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{s.startTime}〜{s.endTime}</span>}
                      {s.liverName && <span className="flex items-center gap-1"><Video className="h-3.5 w-3.5" />{s.liverName}</span>}
                      {s.platform && <Badge variant="outline" className="text-xs">{s.platform}</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" onClick={() => {
                    const newDate = prompt("複製先の日付 (YYYY-MM-DD):", new Date().toISOString().split("T")[0]);
                    if (newDate) duplicateMutation.mutate({ sessionId: s.id, newDate });
                  }}><Copy className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                    if (confirm("このRundownを削除しますか？")) deleteMutation.mutate({ id: s.id });
                  }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {sessionsQuery.data?.sessions?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>まだRundownがありません</p>
            <p className="text-sm">「新規作成」ボタンから最初のRundownを作成しましょう</p>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>新規Rundown作成</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">タイトル *</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="例: LCJプレミアムセレクトKG専場" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">配信日 *</label>
                <Input type="date" value={form.liveDate} onChange={(e) => setForm({ ...form, liveDate: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">ライバー</label>
                <Select value={form.liverId} onValueChange={(v) => {
                  const liver = (liversQuery.data || []).find((l: any) => String(l.id) === v);
                  setForm({ ...form, liverId: v, liverName: liver?.name || "" });
                }}>
                  <SelectTrigger><SelectValue placeholder="選択..." /></SelectTrigger>
                  <SelectContent>
                    {(liversQuery.data || []).map((l: any) => (
                      <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">開始時間</label>
                <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">終了時間</label>
                <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">プラットフォーム</label>
                <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TikTok">TikTok</SelectItem>
                    <SelectItem value="Instagram">Instagram</SelectItem>
                    <SelectItem value="YouTube">YouTube</SelectItem>
                    <SelectItem value="その他">その他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">店舗名</label>
                <Input value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">テーマ</label>
              <Input value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })} placeholder="例: キラキラ金曜、なんといいライブ！" />
            </div>
            <div>
              <label className="text-sm font-medium">運営担当</label>
              <Input value={form.operatorName} onChange={(e) => setForm({ ...form, operatorName: e.target.value })} placeholder="例: 賈艶梅 朱羽" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>キャンセル</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>作成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ SESSION DETAIL (Tabs: Rundown / Checklist / Review) ============
function SessionDetail({ sessionId, onBack }: { sessionId: number; onBack: () => void }) {
  const { toast } = useToast();
  const detailQuery = trpc.rundown.getSessionById.useQuery({ id: sessionId });
  const updateSessionMutation = trpc.rundown.updateSession.useMutation({ onSuccess: () => detailQuery.refetch() });

  if (detailQuery.isLoading) return <div className="text-center py-12">読み込み中...</div>;
  if (!detailQuery.data) return <div className="text-center py-12">データが見つかりません</div>;

  const { session, items, checklist, review, reviewItems } = detailQuery.data;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack}>← 戻る</Button>
          <div>
            <h1 className="text-xl font-bold">{session.title}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{session.liveDate?.split("T")[0]}</span>
              {session.startTime && <span>{session.startTime}〜{session.endTime}</span>}
              {session.liverName && <span>🎤 {session.liverName}</span>}
              {session.theme && <span>テーマ: {session.theme}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={session.status} onValueChange={(v) => updateSessionMutation.mutate({ id: sessionId, status: v })}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">下書き</SelectItem>
              <SelectItem value="ready">準備完了</SelectItem>
              <SelectItem value="live">配信中</SelectItem>
              <SelectItem value="completed">完了</SelectItem>
              <SelectItem value="cancelled">キャンセル</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rundown" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rundown" className="gap-2"><FileSpreadsheet className="h-4 w-4" />Rundown ({items.length})</TabsTrigger>
          <TabsTrigger value="checklist" className="gap-2"><CheckCircle2 className="h-4 w-4" />チェックリスト</TabsTrigger>
          <TabsTrigger value="review" className="gap-2"><BarChart3 className="h-4 w-4" />復盤</TabsTrigger>
        </TabsList>

        <TabsContent value="rundown">
          <RundownTable sessionId={sessionId} items={items} onRefresh={() => detailQuery.refetch()} />
        </TabsContent>
        <TabsContent value="checklist">
          <ChecklistPanel sessionId={sessionId} checklist={checklist} onRefresh={() => detailQuery.refetch()} />
        </TabsContent>
        <TabsContent value="review">
          <ReviewPanel sessionId={sessionId} review={review} reviewItems={reviewItems} items={items} onRefresh={() => detailQuery.refetch()} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ RUNDOWN TABLE ============
function RundownTable({ sessionId, items, onRefresh }: { sessionId: number; items: any[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const addMutation = trpc.rundown.addItem.useMutation({ onSuccess: () => { onRefresh(); setShowAdd(false); toast({ title: "追加完了" }); } });
  const updateMutation = trpc.rundown.updateItem.useMutation({ onSuccess: () => { onRefresh(); setEditingItem(null); toast({ title: "更新完了" }); } });
  const deleteMutation = trpc.rundown.deleteItem.useMutation({ onSuccess: () => { onRefresh(); toast({ title: "削除完了" }); } });
  const reorderMutation = trpc.rundown.reorderItems.useMutation({ onSuccess: onRefresh });
  const searchProductsQuery = trpc.rundown.searchProducts.useQuery(
    { query: searchQuery, limit: 10 },
    { enabled: searchQuery.length >= 2 }
  );

  const [itemForm, setItemForm] = useState<any>({
    sessionId, timeSlot: "", durationMinutes: null, section: "LCJ プレミアムセレクト",
    productName: "", productNameCn: "", brandName: "", imageUrl: "", productLink: "",
    selfSiteLink: "", theme: "", bundleCombo: "", listPrice: null, livePrice: null,
    costPrice: null, purchasePrice: null, commissionRate: null, bundlePrice: "",
    shopAndFormat: "LCJ/単品", estimatedGmv: null, playStrategy: "", recommendReason: "", notes: "",
  });

  const resetForm = () => setItemForm({
    sessionId, timeSlot: "", durationMinutes: null, section: "LCJ プレミアムセレクト",
    productName: "", productNameCn: "", brandName: "", imageUrl: "", productLink: "",
    selfSiteLink: "", theme: "", bundleCombo: "", listPrice: null, livePrice: null,
    costPrice: null, purchasePrice: null, commissionRate: null, bundlePrice: "",
    shopAndFormat: "LCJ/単品", estimatedGmv: null, playStrategy: "", recommendReason: "", notes: "",
  });

  const selectProduct = (p: any) => {
    setItemForm({
      ...itemForm,
      productId: p.id,
      productName: p.productName,
      productNameCn: p.productNameCn || "",
      brandName: p.brandName || "",
      imageUrl: p.images?.[0] || "",
      productLink: p.productLink || "",
      listPrice: p.price ? Number(p.price) : null,
      costPrice: p.costPrice ? Number(p.costPrice) : null,
      purchasePrice: p.purchasePrice ? Number(p.purchasePrice) : null,
      commissionRate: p.commissionType === "percentage" ? Number(p.commissionValue) : null,
      livePrice: p.suggestedPrice ? Number(p.suggestedPrice) : null,
      bundlePrice: p.mechanism || "",
    });
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleSave = () => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...itemForm });
    } else {
      addMutation.mutate(itemForm);
    }
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const ids = items.map((i: any) => i.id);
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= ids.length) return;
    [ids[index], ids[newIndex]] = [ids[newIndex], ids[index]];
    reorderMutation.mutate({ sessionId, itemIds: ids });
  };

  const totalEstimatedGmv = items.reduce((sum: number, i: any) => sum + (Number(i.estimatedGmv) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">商品数: <strong>{items.length}</strong></span>
          {totalEstimatedGmv > 0 && <span className="text-sm text-muted-foreground">予想GMV合計: <strong className="text-green-600">¥{totalEstimatedGmv.toLocaleString()}</strong></span>}
        </div>
        <Button onClick={() => { resetForm(); setShowAdd(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> 商品追加
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-blue-50 border-b">
            <tr>
              <th className="px-2 py-2 text-center w-8">#</th>
              <th className="px-2 py-2 text-left">時段</th>
              <th className="px-2 py-2 text-left">板块</th>
              <th className="px-2 py-2 text-center w-16">図片</th>
              <th className="px-2 py-2 text-left">主題/福袋組合</th>
              <th className="px-2 py-2 text-left">品牌</th>
              <th className="px-2 py-2 text-left">中文名</th>
              <th className="px-2 py-2 text-right">挂価</th>
              <th className="px-2 py-2 text-right">直播価格</th>
              <th className="px-2 py-2 text-right">成本価</th>
              <th className="px-2 py-2 text-right">佣金%</th>
              <th className="px-2 py-2 text-left">福袋/歴史</th>
              <th className="px-2 py-2 text-left">店舗形式</th>
              <th className="px-2 py-2 text-right">予想GMV</th>
              <th className="px-2 py-2 text-center w-24">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, idx: number) => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="px-2 py-2 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <button onClick={() => moveItem(idx, "up")} className="text-gray-400 hover:text-gray-700" disabled={idx === 0}><ArrowUp className="h-3 w-3" /></button>
                    <span className="font-mono text-xs">{idx + 1}</span>
                    <button onClick={() => moveItem(idx, "down")} className="text-gray-400 hover:text-gray-700" disabled={idx === items.length - 1}><ArrowDown className="h-3 w-3" /></button>
                  </div>
                </td>
                <td className="px-2 py-2 text-xs">{item.timeSlot || "-"}</td>
                <td className="px-2 py-2 text-xs">{item.section || "-"}</td>
                <td className="px-2 py-2 text-center">
                  {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-10 h-10 object-cover rounded" /> : <Package className="h-5 w-5 text-gray-300 mx-auto" />}
                </td>
                <td className="px-2 py-2 text-xs max-w-[120px] truncate">{item.theme || item.bundleCombo || "-"}</td>
                <td className="px-2 py-2 text-xs">{item.brandName || "-"}</td>
                <td className="px-2 py-2 text-xs font-medium">{item.productNameCn || item.productName || "-"}</td>
                <td className="px-2 py-2 text-right text-xs">{item.listPrice ? `¥${Number(item.listPrice).toLocaleString()}` : "-"}</td>
                <td className="px-2 py-2 text-right text-xs font-medium text-red-600">{item.livePrice ? `¥${Number(item.livePrice).toLocaleString()}` : "-"}</td>
                <td className="px-2 py-2 text-right text-xs">{item.costPrice ? `¥${Number(item.costPrice).toLocaleString()}` : "-"}</td>
                <td className="px-2 py-2 text-right text-xs">{item.commissionRate ? `${item.commissionRate}%` : "-"}</td>
                <td className="px-2 py-2 text-xs max-w-[100px] truncate">{item.bundlePrice || "-"}</td>
                <td className="px-2 py-2 text-xs">{item.shopAndFormat || "-"}</td>
                <td className="px-2 py-2 text-right text-xs font-medium text-green-600">{item.estimatedGmv ? `¥${Number(item.estimatedGmv).toLocaleString()}` : "-"}</td>
                <td className="px-2 py-2 text-center">
                  <div className="flex items-center gap-1 justify-center">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                      setEditingItem(item);
                      setItemForm({ ...item, sessionId });
                      setShowAdd(true);
                    }}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                      if (confirm("削除しますか？")) deleteMutation.mutate({ id: item.id });
                    }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={15} className="text-center py-8 text-muted-foreground">商品がまだ追加されていません</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd} onOpenChange={(open) => { if (!open) { setShowAdd(false); setEditingItem(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? "商品編集" : "商品追加"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Product search */}
            {!editingItem && (
              <div className="relative">
                <label className="text-sm font-medium">選品センターから検索</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="商品名、ブランド名、バーコードで検索..." />
                </div>
                {searchProductsQuery.data && searchProductsQuery.data.length > 0 && searchQuery.length >= 2 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchProductsQuery.data.map((p: any) => (
                      <div key={p.id} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-3" onClick={() => selectProduct(p)}>
                        {p.images?.[0] && <img src={p.images[0]} className="w-8 h-8 object-cover rounded" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.productNameCn || p.productName}</p>
                          <p className="text-xs text-muted-foreground">{p.brandName} | ¥{p.price}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">時段</label>
                <Input value={itemForm.timeSlot || ""} onChange={(e) => setItemForm({ ...itemForm, timeSlot: e.target.value })} placeholder="例: 20:30-20:45" />
              </div>
              <div>
                <label className="text-sm font-medium">述品時間(分)</label>
                <Input type="number" value={itemForm.durationMinutes || ""} onChange={(e) => setItemForm({ ...itemForm, durationMinutes: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">板块</label>
                <Input value={itemForm.section || ""} onChange={(e) => setItemForm({ ...itemForm, section: e.target.value })} placeholder="LCJ プレミアムセレクト" />
              </div>
              <div>
                <label className="text-sm font-medium">品牌</label>
                <Input value={itemForm.brandName || ""} onChange={(e) => setItemForm({ ...itemForm, brandName: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">商品名</label>
                <Input value={itemForm.productName || ""} onChange={(e) => setItemForm({ ...itemForm, productName: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">中文名</label>
                <Input value={itemForm.productNameCn || ""} onChange={(e) => setItemForm({ ...itemForm, productNameCn: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">主題 / 参考福袋組合</label>
              <Input value={itemForm.theme || ""} onChange={(e) => setItemForm({ ...itemForm, theme: e.target.value })} placeholder="例: 福袋一：DDラクメシ バグバグ(预售7.19)" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">商品リンク</label>
                <Input value={itemForm.productLink || ""} onChange={(e) => setItemForm({ ...itemForm, productLink: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">自制サイトリンク</label>
                <Input value={itemForm.selfSiteLink || ""} onChange={(e) => setItemForm({ ...itemForm, selfSiteLink: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-sm font-medium">挂価</label>
                <Input type="number" value={itemForm.listPrice || ""} onChange={(e) => setItemForm({ ...itemForm, listPrice: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div>
                <label className="text-sm font-medium">直播価格</label>
                <Input type="number" value={itemForm.livePrice || ""} onChange={(e) => setItemForm({ ...itemForm, livePrice: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div>
                <label className="text-sm font-medium">成本価(含運費)</label>
                <Input type="number" value={itemForm.costPrice || ""} onChange={(e) => setItemForm({ ...itemForm, costPrice: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div>
                <label className="text-sm font-medium">拿货价</label>
                <Input type="number" value={itemForm.purchasePrice || ""} onChange={(e) => setItemForm({ ...itemForm, purchasePrice: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">佣金比例(%)</label>
                <Input type="number" value={itemForm.commissionRate || ""} onChange={(e) => setItemForm({ ...itemForm, commissionRate: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div>
                <label className="text-sm font-medium">福袋価格/歴史機制</label>
                <Input value={itemForm.bundlePrice || ""} onChange={(e) => setItemForm({ ...itemForm, bundlePrice: e.target.value })} placeholder="例: 1瓶6980 2瓶9350" />
              </div>
              <div>
                <label className="text-sm font-medium">上架店舗/形式</label>
                <Input value={itemForm.shopAndFormat || ""} onChange={(e) => setItemForm({ ...itemForm, shopAndFormat: e.target.value })} placeholder="例: LCJ/単品" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">予想GMV</label>
                <Input type="number" value={itemForm.estimatedGmv || ""} onChange={(e) => setItemForm({ ...itemForm, estimatedGmv: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div>
                <label className="text-sm font-medium">画像URL</label>
                <Input value={itemForm.imageUrl || ""} onChange={(e) => setItemForm({ ...itemForm, imageUrl: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">節奏 / 玩法</label>
              <Textarea value={itemForm.playStrategy || ""} onChange={(e) => setItemForm({ ...itemForm, playStrategy: e.target.value })} rows={2} />
            </div>
            <div>
              <label className="text-sm font-medium">推薦理由</label>
              <Textarea value={itemForm.recommendReason || ""} onChange={(e) => setItemForm({ ...itemForm, recommendReason: e.target.value })} rows={2} />
            </div>
            <div>
              <label className="text-sm font-medium">備考</label>
              <Textarea value={itemForm.notes || ""} onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditingItem(null); }}>キャンセル</Button>
            <Button onClick={handleSave} disabled={addMutation.isPending || updateMutation.isPending}>
              {editingItem ? "更新" : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ CHECKLIST PANEL ============
function ChecklistPanel({ sessionId, checklist, onRefresh }: { sessionId: number; checklist: any[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const [newItem, setNewItem] = useState("");
  const [newCategory, setNewCategory] = useState("other");

  const updateMutation = trpc.rundown.updateChecklist.useMutation({ onSuccess: onRefresh });
  const addMutation = trpc.rundown.addChecklistItem.useMutation({ onSuccess: () => { onRefresh(); setNewItem(""); toast({ title: "追加完了" }); } });
  const deleteMutation = trpc.rundown.deleteChecklistItem.useMutation({ onSuccess: onRefresh });

  const categories = { product: "商品準備", equipment: "機材", account: "アカウント", other: "その他" };
  const grouped = Object.entries(categories).map(([key, label]) => ({
    key, label, items: checklist.filter((c: any) => c.category === key),
  }));

  const totalChecked = checklist.filter((c: any) => c.isChecked).length;
  const progress = checklist.length > 0 ? Math.round((totalChecked / checklist.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">準備進捗</span>
            <span className="text-sm font-bold">{totalChecked}/{checklist.length} ({progress}%)</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </CardContent>
      </Card>

      {/* Grouped checklist */}
      {grouped.map(({ key, label, items }) => (
        <Card key={key}>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-bold">{label}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {items.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={!!item.isChecked}
                    onCheckedChange={(checked) => updateMutation.mutate({ id: item.id, isChecked: checked ? 1 : 0 })}
                  />
                  <span className={`text-sm ${item.isChecked ? "line-through text-muted-foreground" : ""}`}>{item.checkItem}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteMutation.mutate({ id: item.id })}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Add new item */}
      <div className="flex gap-2">
        <Select value={newCategory} onValueChange={setNewCategory}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="product">商品準備</SelectItem>
            <SelectItem value="equipment">機材</SelectItem>
            <SelectItem value="account">アカウント</SelectItem>
            <SelectItem value="other">その他</SelectItem>
          </SelectContent>
        </Select>
        <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="新しいチェック項目..." className="flex-1" onKeyDown={(e) => { if (e.key === "Enter" && newItem) addMutation.mutate({ sessionId, checkItem: newItem, category: newCategory }); }} />
        <Button onClick={() => { if (newItem) addMutation.mutate({ sessionId, checkItem: newItem, category: newCategory }); }} disabled={!newItem}>追加</Button>
      </div>
    </div>
  );
}

// ============ REVIEW PANEL ============
function ReviewPanel({ sessionId, review, reviewItems, items, onRefresh }: { sessionId: number; review: any; reviewItems: any[]; items: any[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [reviewForm, setReviewForm] = useState({
    actualStartTime: review?.actualStartTime || "",
    actualEndTime: review?.actualEndTime || "",
    totalGmv: review?.totalGmv ? Number(review.totalGmv) : 0,
    totalOrders: review?.totalOrders || 0,
    totalViewers: review?.totalViewers || 0,
    peakViewers: review?.peakViewers || 0,
    avgViewers: review?.avgViewers || 0,
    newFollowers: review?.newFollowers || 0,
    lessonsLearned: review?.lessonsLearned || "",
    improvements: review?.improvements || "",
  });

  const saveReviewMutation = trpc.rundown.createOrUpdateReview.useMutation({
    onSuccess: () => { onRefresh(); toast({ title: "保存完了" }); },
  });
  const importCsvMutation = trpc.rundown.importTikTokCsv.useMutation({
    onSuccess: (data) => { onRefresh(); toast({ title: "インポート完了", description: `${data.itemsImported}件の商品データを取り込みました` }); },
  });

  const handleCsvUpload = async () => {
    if (!csvFile) return;
    const text = await csvFile.text();
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) { toast({ title: "エラー", description: "CSVデータが不正です", variant: "destructive" }); return; }

    const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
    const data: any[] = [];
    let totalGmv = 0, totalOrders = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim().replace(/"/g, ""));
      const row: any = {};
      headers.forEach((h, idx) => { row[h] = cols[idx] || ""; });

      // Try to map common TikTok CSV columns
      const productName = row["商品名"] || row["product_name"] || row["商品"] || cols[0] || "";
      const gmv = Number(row["GMV"] || row["売上"] || row["金額"] || row["revenue"] || 0);
      const orders = Number(row["注文数"] || row["orders"] || row["件数"] || 0);
      const unitsSold = Number(row["販売数"] || row["units_sold"] || row["数量"] || 0);
      const refundAmount = Number(row["返品金額"] || row["refund_amount"] || 0);
      const refundCount = Number(row["返品数"] || row["refund_count"] || 0);

      if (productName) {
        data.push({ productName, gmv, orders, unitsSold, refundAmount, refundCount });
        totalGmv += gmv;
        totalOrders += orders;
      }
    }

    importCsvMutation.mutate({
      sessionId,
      csvData: data,
      summary: { totalGmv, totalOrders },
    });
  };

  const totalEstimatedGmv = items.reduce((sum: number, i: any) => sum + (Number(i.estimatedGmv) || 0), 0);
  const actualGmv = Number(reviewForm.totalGmv) || 0;
  const gmvDiff = actualGmv - totalEstimatedGmv;

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">実績GMV</p>
            <p className="text-lg font-bold text-green-600">¥{actualGmv.toLocaleString()}</p>
            {totalEstimatedGmv > 0 && (
              <p className={`text-xs ${gmvDiff >= 0 ? "text-green-500" : "text-red-500"}`}>
                {gmvDiff >= 0 ? "+" : ""}¥{gmvDiff.toLocaleString()} vs 予想
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">注文数</p>
            <p className="text-lg font-bold">{reviewForm.totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">視聴者数</p>
            <p className="text-lg font-bold">{reviewForm.totalViewers}</p>
            {reviewForm.peakViewers > 0 && <p className="text-xs text-muted-foreground">ピーク: {reviewForm.peakViewers}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">新規フォロワー</p>
            <p className="text-lg font-bold">{reviewForm.newFollowers}</p>
          </CardContent>
        </Card>
      </div>

      {/* CSV Import */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2"><Upload className="h-4 w-4" />TikTok CSVインポート</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-center gap-3">
            <Input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} className="flex-1" />
            <Button onClick={handleCsvUpload} disabled={!csvFile || importCsvMutation.isPending}>
              {importCsvMutation.isPending ? "処理中..." : "インポート"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">TikTokからダウンロードした商品売上CSVをアップロードしてください</p>
        </CardContent>
      </Card>

      {/* Review Items (from CSV) */}
      {reviewItems.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-bold">商品別実績</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-2 py-1.5 text-left">商品名</th>
                    <th className="px-2 py-1.5 text-right">GMV</th>
                    <th className="px-2 py-1.5 text-right">注文数</th>
                    <th className="px-2 py-1.5 text-right">販売数</th>
                    <th className="px-2 py-1.5 text-right">返品</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewItems.map((ri: any) => (
                    <tr key={ri.id} className="border-b">
                      <td className="px-2 py-1.5 text-xs">{ri.productName || "-"}</td>
                      <td className="px-2 py-1.5 text-right text-xs font-medium">¥{Number(ri.actualGmv).toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-right text-xs">{ri.actualOrders}</td>
                      <td className="px-2 py-1.5 text-right text-xs">{ri.actualUnitsSold}</td>
                      <td className="px-2 py-1.5 text-right text-xs text-red-500">{ri.refundCount > 0 ? `${ri.refundCount}件` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Review Form */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-bold">復盤データ入力</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium">実際開始時間</label>
              <Input type="time" value={reviewForm.actualStartTime} onChange={(e) => setReviewForm({ ...reviewForm, actualStartTime: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium">実際終了時間</label>
              <Input type="time" value={reviewForm.actualEndTime} onChange={(e) => setReviewForm({ ...reviewForm, actualEndTime: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium">総GMV</label>
              <Input type="number" value={reviewForm.totalGmv || ""} onChange={(e) => setReviewForm({ ...reviewForm, totalGmv: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs font-medium">注文数</label>
              <Input type="number" value={reviewForm.totalOrders || ""} onChange={(e) => setReviewForm({ ...reviewForm, totalOrders: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium">累計視聴者</label>
              <Input type="number" value={reviewForm.totalViewers || ""} onChange={(e) => setReviewForm({ ...reviewForm, totalViewers: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs font-medium">ピーク視聴者</label>
              <Input type="number" value={reviewForm.peakViewers || ""} onChange={(e) => setReviewForm({ ...reviewForm, peakViewers: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs font-medium">平均視聴者</label>
              <Input type="number" value={reviewForm.avgViewers || ""} onChange={(e) => setReviewForm({ ...reviewForm, avgViewers: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs font-medium">新規フォロワー</label>
              <Input type="number" value={reviewForm.newFollowers || ""} onChange={(e) => setReviewForm({ ...reviewForm, newFollowers: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">学んだこと / 反省点</label>
            <Textarea value={reviewForm.lessonsLearned} onChange={(e) => setReviewForm({ ...reviewForm, lessonsLearned: e.target.value })} rows={3} placeholder="今回の配信で学んだこと..." />
          </div>
          <div>
            <label className="text-xs font-medium">改善点 / 次回への提案</label>
            <Textarea value={reviewForm.improvements} onChange={(e) => setReviewForm({ ...reviewForm, improvements: e.target.value })} rows={3} placeholder="次回改善したいこと..." />
          </div>
          <Button onClick={() => saveReviewMutation.mutate({ sessionId, ...reviewForm })} disabled={saveReviewMutation.isPending} className="w-full">
            {saveReviewMutation.isPending ? "保存中..." : "復盤データを保存"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ MAIN COMPONENT ============
export default function RundownManager() {
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  if (selectedSessionId) {
    return <SessionDetail sessionId={selectedSessionId} onBack={() => setSelectedSessionId(null)} />;
  }

  return <SessionList onSelect={setSelectedSessionId} />;
}
