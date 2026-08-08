import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Download, Save, Image, Palette, Type, Upload, GripVertical, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// 配色プリセット
const COLOR_PRESETS = [
  { id: "pastel-pink-blue", name: "パステルピンク×水色", bg: "linear-gradient(135deg, #fce4ec 0%, #e3f2fd 50%, #f3e5f5 100%)" },
  { id: "pastel-purple", name: "パステルパープル", bg: "linear-gradient(135deg, #f3e5f5 0%, #e8eaf6 50%, #ede7f6 100%)" },
  { id: "pastel-mint", name: "パステルミント", bg: "linear-gradient(135deg, #e0f7fa 0%, #e8f5e9 50%, #f1f8e9 100%)" },
  { id: "warm-gold", name: "ウォームゴールド", bg: "linear-gradient(135deg, #fff8e1 0%, #fff3e0 50%, #fbe9e7 100%)" },
  { id: "cool-blue", name: "クールブルー", bg: "linear-gradient(135deg, #e3f2fd 0%, #e1f5fe 50%, #e0f2f1 100%)" },
  { id: "soft-coral", name: "ソフトコーラル", bg: "linear-gradient(135deg, #fce4ec 0%, #fff3e0 50%, #fce4ec 100%)" },
];

type SetItem = {
  assetId: number;
  name: string;
  imageUrl: string;
  label: string;
  size: number; // 1-3 scale
};

export default function SetImageGenerator() {
  const { toast } = useToast();
  const previewRef = useRef<HTMLDivElement>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState("editor");

  // Asset management
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetCategory, setNewAssetCategory] = useState("");
  const [newAssetBrand, setNewAssetBrand] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editor state
  const [title, setTitle] = useState("TikTokShop限定セット");
  const [brandName, setBrandName] = useState("");
  const [bottomText, setBottomText] = useState("なくなり次第即終了！");
  const [couponText, setCouponText] = useState("");
  const [colorPreset, setColorPreset] = useState(COLOR_PRESETS[0].id);
  const [items, setItems] = useState<SetItem[]>([]);
  const [imageSize, setImageSize] = useState<"1:1" | "4:3" | "16:9">("1:1");

  // Preset
  const [presetName, setPresetName] = useState("");
  const [savePresetOpen, setSavePresetOpen] = useState(false);

  // Queries
  const assetsQuery = trpc.setImage.getAssets.useQuery({});
  const presetsQuery = trpc.setImage.getPresets.useQuery();
  const createAssetMutation = trpc.setImage.createAsset.useMutation({
    onSuccess: () => { assetsQuery.refetch(); setUploadDialogOpen(false); setNewAssetName(""); setNewAssetCategory(""); setNewAssetBrand(""); },
  });
  const deleteAssetMutation = trpc.setImage.deleteAsset.useMutation({
    onSuccess: () => assetsQuery.refetch(),
  });
  const savePresetMutation = trpc.setImage.savePreset.useMutation({
    onSuccess: () => { presetsQuery.refetch(); setSavePresetOpen(false); toast({ title: "プリセット保存完了" }); },
  });
  const deletePresetMutation = trpc.setImage.deletePreset.useMutation({
    onSuccess: () => presetsQuery.refetch(),
  });

  // Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !newAssetName) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/set-image-asset-upload", { method: "POST", body: formData, credentials: "include" });
      const data = await res.json();
      if (data.url) {
        await createAssetMutation.mutateAsync({
          name: newAssetName,
          imageUrl: data.url,
          imageKey: data.key,
          category: newAssetCategory || undefined,
          brandName: newAssetBrand || undefined,
        });
        toast({ title: "素材を追加しました" });
      }
    } catch (err) {
      toast({ title: "アップロード失敗", variant: "destructive" });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Add item to set
  const addItemToSet = (asset: any) => {
    if (items.find(i => i.assetId === asset.id)) return;
    setItems([...items, { assetId: asset.id, name: asset.name, imageUrl: asset.imageUrl, label: asset.name, size: 2 }]);
  };

  // Remove item from set
  const removeItem = (assetId: number) => {
    setItems(items.filter(i => i.assetId !== assetId));
  };

  // Update item label
  const updateItemLabel = (assetId: number, label: string) => {
    setItems(items.map(i => i.assetId === assetId ? { ...i, label } : i));
  };

  // Update item size
  const updateItemSize = (assetId: number, size: number) => {
    setItems(items.map(i => i.assetId === assetId ? { ...i, size } : i));
  };

  // Load preset
  const loadPreset = (preset: any) => {
    const config = typeof preset.config === 'string' ? JSON.parse(preset.config) : preset.config;
    setTitle(config.title || "");
    setBottomText(config.bottomText || "");
    setColorPreset(config.colorPreset || COLOR_PRESETS[0].id);
    // Rebuild items from assets
    const assets = assetsQuery.data || [];
    const loadedItems: SetItem[] = [];
    for (const item of config.items || []) {
      const asset = assets.find((a: any) => a.id === item.assetId);
      if (asset) {
        loadedItems.push({ assetId: asset.id, name: asset.name, imageUrl: asset.imageUrl, label: item.label, size: item.size });
      }
    }
    setItems(loadedItems);
    setActiveTab("editor");
    toast({ title: `プリセット「${preset.name}」を読み込みました` });
  };

  // Export as PNG
  const exportAsPng = useCallback(async () => {
    if (!previewRef.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(previewRef.current, {
        scale: 3, // High resolution
        useCORS: true,
        backgroundColor: null,
      });
      const link = document.createElement("a");
      link.download = `set-image-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({ title: "PNG書き出し完了" });
    } catch (err) {
      toast({ title: "書き出し失敗", variant: "destructive" });
    }
  }, []);

  const selectedBg = COLOR_PRESETS.find(c => c.id === colorPreset)?.bg || COLOR_PRESETS[0].bg;
  const aspectRatio = imageSize === "1:1" ? "1/1" : imageSize === "4:3" ? "4/3" : "16/9";

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">🎨 セット画像生成ツール</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setSavePresetOpen(true)} disabled={items.length === 0}>
            <Save className="h-4 w-4 mr-1" />プリセット保存
          </Button>
          <Button size="sm" onClick={exportAsPng} disabled={items.length === 0}>
            <Download className="h-4 w-4 mr-1" />PNG書き出し
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="editor"><Palette className="h-4 w-4 mr-1" />エディタ</TabsTrigger>
          <TabsTrigger value="assets"><Image className="h-4 w-4 mr-1" />素材管理</TabsTrigger>
          <TabsTrigger value="presets"><Save className="h-4 w-4 mr-1" />プリセット</TabsTrigger>
        </TabsList>

        {/* エディタ Tab */}
        <TabsContent value="editor">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 左: 設定パネル */}
            <div className="space-y-4">
              {/* テキスト設定 */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-medium flex items-center gap-1"><Type className="h-4 w-4" />テキスト設定</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">ブランド名</label>
                      <Input value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="Brighte" className="text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">見出し</label>
                      <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="TikTokShop限定セット" className="text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">下部訴求文</label>
                      <Input value={bottomText} onChange={e => setBottomText(e.target.value)} placeholder="なくなり次第即終了！" className="text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">クーポン額</label>
                      <Input value={couponText} onChange={e => setCouponText(e.target.value)} placeholder="43,060円OFFクーポン" className="text-sm" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 配色設定 */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-medium flex items-center gap-1"><Palette className="h-4 w-4" />背景配色</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {COLOR_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => setColorPreset(preset.id)}
                        className={`p-2 rounded-lg border-2 transition-all ${colorPreset === preset.id ? "border-purple-500 ring-2 ring-purple-200" : "border-gray-200 hover:border-gray-300"}`}
                      >
                        <div className="h-8 rounded" style={{ background: preset.bg }} />
                        <div className="text-[10px] mt-1 text-center">{preset.name}</div>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <label className="text-xs text-gray-500">サイズ:</label>
                    {(["1:1", "4:3", "16:9"] as const).map(s => (
                      <button key={s} onClick={() => setImageSize(s)} className={`text-xs px-2 py-1 rounded ${imageSize === s ? "bg-purple-500 text-white" : "bg-gray-100"}`}>{s}</button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 商品選択 */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-medium flex items-center gap-1"><Image className="h-4 w-4" />商品を追加</h3>
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                    {(assetsQuery.data || []).map((asset: any) => (
                      <button
                        key={asset.id}
                        onClick={() => addItemToSet(asset)}
                        disabled={!!items.find(i => i.assetId === asset.id)}
                        className={`p-1 border rounded-lg text-center transition-all ${items.find(i => i.assetId === asset.id) ? "opacity-40 border-green-300 bg-green-50" : "hover:border-purple-300 hover:bg-purple-50"}`}
                      >
                        <img src={asset.imageUrl} alt={asset.name} className="w-full h-12 object-contain" />
                        <div className="text-[9px] truncate mt-0.5">{asset.name}</div>
                      </button>
                    ))}
                    {(!assetsQuery.data || assetsQuery.data.length === 0) && (
                      <div className="col-span-4 text-center text-xs text-gray-400 py-4">
                        素材がありません。「素材管理」タブで追加してください。
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 選択済み商品の編集 */}
              {items.length > 0 && (
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h3 className="text-sm font-medium">選択済み商品 ({items.length}点)</h3>
                    {items.map((item, idx) => (
                      <div key={item.assetId} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <GripVertical className="h-4 w-4 text-gray-300" />
                        <img src={item.imageUrl} alt={item.name} className="w-8 h-8 object-contain" />
                        <Input value={item.label} onChange={e => updateItemLabel(item.assetId, e.target.value)} className="text-xs flex-1" />
                        <select value={item.size} onChange={e => updateItemSize(item.assetId, Number(e.target.value))} className="text-xs border rounded px-1 py-0.5">
                          <option value={1}>小</option>
                          <option value={2}>中</option>
                          <option value={3}>大</option>
                        </select>
                        <button onClick={() => removeItem(item.assetId)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* 右: プレビュー */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">プレビュー</h3>
              <div className="border rounded-lg overflow-hidden shadow-lg" style={{ maxWidth: "500px" }}>
                <div
                  ref={previewRef}
                  style={{
                    background: selectedBg,
                    aspectRatio,
                    padding: "20px 16px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "space-between",
                    position: "relative",
                    fontFamily: "'Noto Sans JP', sans-serif",
                  }}
                >
                  {/* 上部: ブランド名 + タイトル */}
                  <div style={{ textAlign: "left", width: "100%", position: "relative" }}>
                    {brandName && (
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "#333", letterSpacing: "2px" }}>{brandName}</div>
                    )}
                    <div style={{ fontSize: "28px", fontWeight: 900, color: "#111", marginTop: "2px", lineHeight: 1.2 }}>
                      {title}
                    </div>
                    {/* TikTok Logo - 右上 */}
                    <div style={{ position: "absolute", top: 0, right: 0 }}>
                      <img src="https://upload.wikimedia.org/wikipedia/en/a/a9/TikTok_logo.svg" alt="TikTok" style={{ height: "48px", opacity: 0.9 }} />
                    </div>
                  </div>

                  {/* 中央: 商品グリッド */}
                  <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    alignItems: "flex-end",
                    gap: "8px",
                    flex: 1,
                    padding: "12px 0",
                    width: "100%",
                  }}>
                    {items.map(item => {
                      const imgSize = item.size === 1 ? "55px" : item.size === 2 ? "80px" : "110px";
                      const labelColors = ["#4fc3f7", "#f48fb1", "#81c784", "#ffb74d", "#ce93d8", "#90a4ae"];
                      const colorIdx = items.indexOf(item) % labelColors.length;
                      return (
                        <div key={item.assetId} style={{ textAlign: "center", maxWidth: item.size === 3 ? "130px" : "90px" }}>
                          <img src={item.imageUrl} alt={item.label} style={{ width: imgSize, height: imgSize, objectFit: "contain", margin: "0 auto" }} />
                          <div style={{
                            fontSize: "8px",
                            color: "white",
                            marginTop: "4px",
                            fontWeight: 700,
                            background: labelColors[colorIdx],
                            borderRadius: "10px",
                            padding: "2px 6px",
                            display: "inline-block",
                          }}>{item.label}</div>
                        </div>
                      );
                    })}
                    {items.length === 0 && (
                      <div style={{ color: "#999", fontSize: "12px" }}>← 左から商品を追加してください</div>
                    )}
                  </div>

                  {/* 下部: 訴求帯 */}
                  {(bottomText || couponText) && (
                    <div style={{
                      background: "linear-gradient(90deg, #c62828, #d32f2f)",
                      color: "white",
                      padding: "10px 16px",
                      borderRadius: "4px",
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}>
                      {bottomText && <div style={{ fontSize: "11px", fontWeight: 700, lineHeight: 1.3 }}>{bottomText}</div>}
                      {couponText && <div style={{ fontSize: "20px", fontWeight: 900, letterSpacing: "1px" }}>{couponText}</div>}
                    </div>
                  )}

                  {/* 最下部: 公式ショップ帯 */}
                  <div style={{
                    fontSize: "11px",
                    color: "#333",
                    marginTop: "6px",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderTop: "1px solid rgba(0,0,0,0.1)",
                    paddingTop: "6px",
                  }}>
                    <span style={{ fontWeight: 600 }}>♪ 公式ショップ</span>
                    <span style={{ fontSize: "10px", color: "#666" }}>さらに探す &gt;</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={exportAsPng} disabled={items.length === 0} className="flex-1">
                  <Download className="h-4 w-4 mr-1" />高解像度PNG書き出し
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 素材管理 Tab */}
        <TabsContent value="assets">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">商品素材ライブラリ</h3>
              <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />素材を追加
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {(assetsQuery.data || []).map((asset: any) => (
                <Card key={asset.id} className="overflow-hidden">
                  <div className="aspect-square bg-gray-50 flex items-center justify-center p-2">
                    <img src={asset.imageUrl} alt={asset.name} className="max-w-full max-h-full object-contain" />
                  </div>
                  <CardContent className="p-2">
                    <div className="text-xs font-medium truncate">{asset.name}</div>
                    {asset.category && <Badge variant="outline" className="text-[9px] mt-1">{asset.category}</Badge>}
                    <button onClick={() => { if (confirm("削除しますか？")) deleteAssetMutation.mutate({ id: asset.id }); }} className="text-red-400 hover:text-red-600 mt-1 block">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </CardContent>
                </Card>
              ))}
              {(!assetsQuery.data || assetsQuery.data.length === 0) && (
                <div className="col-span-6 text-center text-gray-400 py-8">
                  まだ素材がありません。「素材を追加」ボタンから透明背景PNGをアップロードしてください。
                </div>
              )}
            </div>
          </div>

          {/* Upload Dialog */}
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>素材を追加</DialogTitle>
                <DialogDescription>透明背景PNG画像をアップロードしてください</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">商品名 *</label>
                  <Input value={newAssetName} onChange={e => setNewAssetName(e.target.value)} placeholder="例: エレキローション" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">カテゴリ</label>
                    <Input value={newAssetCategory} onChange={e => setNewAssetCategory(e.target.value)} placeholder="例: 本体/おまけ品" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">ブランド名</label>
                    <Input value={newAssetBrand} onChange={e => setNewAssetBrand(e.target.value)} placeholder="例: Brighte" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">画像ファイル (PNG推奨) *</label>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="block w-full text-sm mt-1" disabled={!newAssetName || uploading} />
                </div>
                {uploading && <div className="text-xs text-blue-600">アップロード中...</div>}
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* プリセット Tab */}
        <TabsContent value="presets">
          <div className="space-y-4">
            <h3 className="text-sm font-medium">保存済みプリセット</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {(presetsQuery.data || []).map((preset: any) => (
                <Card key={preset.id} className="cursor-pointer hover:border-purple-300 transition-all" onClick={() => loadPreset(preset)}>
                  <CardContent className="p-3">
                    <div className="text-sm font-medium">{preset.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {(() => { const c = typeof preset.config === 'string' ? JSON.parse(preset.config) : preset.config; return `${c.items?.length || 0}商品`; })()}
                    </div>
                    <div className="flex gap-1 mt-2">
                      <Button size="sm" variant="outline" className="text-xs h-6" onClick={(e) => { e.stopPropagation(); loadPreset(preset); }}>読み込み</Button>
                      <Button size="sm" variant="ghost" className="text-xs h-6 text-red-500" onClick={(e) => { e.stopPropagation(); if (confirm("削除しますか？")) deletePresetMutation.mutate({ id: preset.id }); }}>削除</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!presetsQuery.data || presetsQuery.data.length === 0) && (
                <div className="col-span-3 text-center text-gray-400 py-8">
                  保存済みプリセットはありません。エディタでセットを作成し「プリセット保存」してください。
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Save Preset Dialog */}
      <Dialog open={savePresetOpen} onOpenChange={setSavePresetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>プリセット保存</DialogTitle>
            <DialogDescription>現在の設定をプリセットとして保存します</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="プリセット名（例: Brighte基本セット）" />
            <Button onClick={() => {
              if (!presetName) return;
              savePresetMutation.mutate({
                name: presetName,
                config: {
                  title,
                  subtitle: brandName,
                  bottomText: `${bottomText}${couponText ? ` ${couponText}` : ""}`,
                  colorPreset,
                  items: items.map(i => ({ assetId: i.assetId, label: i.label, size: i.size })),
                },
              });
            }} disabled={!presetName} className="w-full">保存</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
