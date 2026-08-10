import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Download, Save, Image, Palette, Type, Upload, GripVertical, X } from "lucide-react";


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
  size: number; // 30-200 pixel scale
  price?: string; // 価格
  rotation: number; // degrees
  x: number; // % position from left
  y: number; // % position from top
  qty: number; // 数量
};

export default function SetImageGenerator() {
  
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
  const [setPrice, setSetPrice] = useState("");
  const [assetSearch, setAssetSearch] = useState("");

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
    onSuccess: () => { presetsQuery.refetch(); setSavePresetOpen(false); alert("プリセット保存完了"); },
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
        alert("素材を追加しました");
      }
    } catch (err) {
      alert("アップロード失敗");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Add item to set
  const addItemToSet = (asset: any) => {
    // 同じ商品が既にある場合は数量を+1
    const existing = items.find(i => i.assetId === asset.id);
    if (existing) {
      setItems(items.map(i => i.assetId === asset.id ? { ...i, qty: i.qty + 1 } : i));
      return;
    }
    const col = items.length % 3;
    const row = Math.floor(items.length / 3);
    setItems([...items, { assetId: asset.id, name: asset.name, imageUrl: asset.imageUrl, label: asset.name, size: 80, price: asset.category || "", rotation: 0, x: 15 + col * 30, y: 25 + row * 30, qty: 1 }]);
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
    alert(`プリセット「${preset.name}」を読み込みました`);
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
      alert("PNG書き出し完了");
    } catch (err) {
      alert("書き出し失敗");
    }
  }, []);

  // Drag state
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState<{ mx: number; my: number; ix: number; iy: number } | null>(null);
  const [resizeId, setResizeId] = useState<number | null>(null);
  const [resizeStart, setResizeStart] = useState<{ mx: number; my: number; size: number } | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragId !== null && dragStart && previewRef.current) {
      const rect = previewRef.current.getBoundingClientRect();
      const dx = ((e.clientX - dragStart.mx) / rect.width) * 100;
      const dy = ((e.clientY - dragStart.my) / rect.height) * 100;
      setItems(prev => prev.map(i => i.assetId === dragId ? { ...i, x: Math.max(0, Math.min(85, dragStart.ix + dx)), y: Math.max(0, Math.min(85, dragStart.iy + dy)) } : i));
    }
    if (resizeId !== null && resizeStart) {
      const dx = e.clientX - resizeStart.mx;
      const newSize = Math.max(30, Math.min(200, resizeStart.size + dx));
      setItems(prev => prev.map(i => i.assetId === resizeId ? { ...i, size: newSize } : i));
    }
  }, [dragId, dragStart, resizeId, resizeStart]);

  const handleMouseUp = useCallback(() => {
    setDragId(null); setDragStart(null); setResizeId(null); setResizeStart(null);
  }, []);

  const selectedBg = COLOR_PRESETS.find(c => c.id === colorPreset)?.bg || COLOR_PRESETS[0].bg;
  const aspectRatio = imageSize === "1:1" ? "1/1" : imageSize === "4:3" ? "4/3" : "16/9";

  // 自動計算: 元値合計・OFF金額・割引率
  const totalOriginalPrice = items.reduce((sum, item) => {
    const p = parseInt(String(item.price || "0").replace(/[^0-9]/g, ""), 10);
    return sum + (isNaN(p) ? 0 : p * (item.qty || 1));
  }, 0);
  const setPriceNum = parseInt(String(setPrice).replace(/[^0-9]/g, ""), 10) || 0;
  const offAmount = totalOriginalPrice - setPriceNum;
  const offPercent = totalOriginalPrice > 0 && setPriceNum > 0 ? Math.round((offAmount / totalOriginalPrice) * 100) : 0;
  const autoCouponText = setPriceNum > 0 && offAmount > 0 ? `${offAmount.toLocaleString()}円OFFクーポン` : couponText;
  const hasMissingPrice = items.some(item => !item.price || parseInt(String(item.price).replace(/[^0-9]/g, ""), 10) === 0);

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
                  {/* セット售価 + 自動計算 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">セット售価</label>
                      <Input value={setPrice} onChange={e => setSetPrice(e.target.value)} placeholder="例: 6980" className="text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">元値合計（自動）</label>
                      <div className="text-sm font-bold mt-1 px-2 py-1.5 bg-gray-50 rounded border">
                        ¥{totalOriginalPrice.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  {setPriceNum > 0 && offAmount > 0 && (
                    <div className="flex items-center gap-2 text-xs bg-red-50 border border-red-200 rounded p-2">
                      <span className="font-bold text-red-600">OFF: ¥{offAmount.toLocaleString()}</span>
                      <span className="text-red-500">(-{offPercent}%)</span>
                      <span className="text-gray-500 ml-auto">横幅に自動反映</span>
                    </div>
                  )}
                  {hasMissingPrice && items.length > 0 && (
                    <div className="text-xs bg-yellow-50 border border-yellow-300 rounded p-2 text-yellow-700">
                      ⚠️ 価格未設定の商品があります。正確な合計を計算するには全商品に価格を設定してください。
                    </div>
                  )}
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
                        
                        className={`p-1 border rounded-lg text-center transition-all ${items.find(i => i.assetId === asset.id) ? "border-green-400 bg-green-50 ring-1 ring-green-300" : "hover:border-purple-300 hover:bg-purple-50"}`}
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
                        <div className="flex-1 space-y-1">
                          <Input value={item.label} onChange={e => updateItemLabel(item.assetId, e.target.value)} className="text-xs" placeholder="商品名" />
                          <Input value={item.price || ""} onChange={e => setItems(items.map(i => i.assetId === item.assetId ? { ...i, price: e.target.value } : i))} className="text-xs" placeholder="値段 例: ¥3,980" />
                        </div>
                        <div className="flex items-center gap-1 min-w-[100px]">
                          <input type="range" min="30" max="200" value={item.size} onChange={e => updateItemSize(item.assetId, Number(e.target.value))} className="w-16" />
                          <span className="text-xs text-gray-500 w-8">{item.size}</span>
                        </div>
                        <div className="flex items-center gap-1 min-w-[70px]" title="回転">
                          <span className="text-xs text-gray-400">↻</span>
                          <input type="range" min="-45" max="45" value={item.rotation || 0} onChange={e => setItems(items.map(i => i.assetId === item.assetId ? { ...i, rotation: Number(e.target.value) } : i))} className="w-10" />
                          <span className="text-xs text-gray-500">{item.rotation || 0}°</span>
                        </div>
                        <div className="flex items-center gap-0.5 border rounded px-1">
                          <button onClick={() => setItems(items.map(i => i.assetId === item.assetId ? { ...i, qty: Math.max(1, (i.qty || 1) - 1) } : i))} className="text-gray-500 hover:text-gray-800 text-xs font-bold px-0.5">-</button>
                          <span className="text-xs font-bold min-w-[14px] text-center">{item.qty || 1}</span>
                          <button onClick={() => setItems(items.map(i => i.assetId === item.assetId ? { ...i, qty: (i.qty || 1) + 1 } : i))} className="text-gray-500 hover:text-gray-800 text-xs font-bold px-0.5">+</button>
                        </div>
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
                  <div
                    style={{ position: "relative", flex: 1, width: "100%", minHeight: "200px" }}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    {items.map(item => {
                      const imgSize = `${item.size}px`;
                      return (
                        <div
                          key={item.assetId}
                          style={{
                            position: "absolute",
                            left: `${item.x}%`,
                            top: `${item.y}%`,
                            transform: `rotate(${item.rotation || 0}deg)`,
                            cursor: dragId === item.assetId ? "grabbing" : "grab",
                            userSelect: "none",
                            textAlign: "center",
                          }}
                          onMouseDown={e => { e.preventDefault(); setDragId(item.assetId); setDragStart({ mx: e.clientX, my: e.clientY, ix: item.x, iy: item.y }); }}
                        >
                          {/* 重なり合い画像（qty > 1） */}
                          <div style={{ position: "relative", width: imgSize, height: imgSize }}>
                            {(item.qty || 1) > 1 && <img src={item.imageUrl} alt="" style={{ position: "absolute", top: "4px", left: "4px", width: imgSize, height: imgSize, objectFit: "contain", opacity: 0.5, pointerEvents: "none" }} draggable={false} />}
                            <img src={item.imageUrl} alt={item.label} style={{ position: "relative", width: imgSize, height: imgSize, objectFit: "contain", display: "block", pointerEvents: "none" }} draggable={false} />
                            {(item.qty || 1) > 1 && <div style={{ position: "absolute", top: "-4px", right: "-4px", background: "#e53935", color: "white", borderRadius: "50%", width: "16px", height: "16px", fontSize: "9px", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>×{item.qty}</div>}
                          </div>
                          <div style={{ fontSize: "8px", fontWeight: 700, marginTop: "1px", color: "#333", lineHeight: 1.1, whiteSpace: "nowrap" }}>{item.label}{(item.qty || 1) > 1 ? ` ×${item.qty}` : ""}</div>
                          {item.price && <div style={{ fontSize: "9px", fontWeight: 900, color: "#e53935", marginTop: "0px" }}>¥{(parseInt(String(item.price).replace(/[^0-9]/g, ""), 10) * (item.qty || 1)).toLocaleString()}</div>}
                          {/* リサイズハンドル */}
                          <div
                            style={{ position: "absolute", bottom: -4, right: -4, width: 10, height: 10, background: "#7c3aed", borderRadius: "50%", cursor: "nwse-resize", opacity: 0.7 }}
                            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setResizeId(item.assetId); setResizeStart({ mx: e.clientX, my: e.clientY, size: item.size }); }}
                          />
                        </div>
                      );
                    })}
                    {items.length === 0 && (
                      <div style={{ color: "#999", fontSize: "12px", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>← 左から商品を追加してください</div>
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
                      {autoCouponText && <div style={{ fontSize: "20px", fontWeight: 900, letterSpacing: "1px" }}>{autoCouponText}</div>}
                    </div>
                  )}
                  {/* セット価格表示 */}
                  {setPriceNum > 0 && (
                    <div style={{ width: "100%", textAlign: "center", marginTop: "4px" }}>
                      <span style={{ fontSize: "24px", fontWeight: 900, color: "#111" }}>¥{setPriceNum.toLocaleString()}</span>
                      {totalOriginalPrice > 0 && (
                        <>
                          <span style={{ fontSize: "12px", color: "#999", textDecoration: "line-through", marginLeft: "8px" }}>¥{totalOriginalPrice.toLocaleString()}</span>
                          {offPercent > 0 && <span style={{ fontSize: "12px", color: "#e53935", fontWeight: 700, marginLeft: "4px" }}>(-{offPercent}%)</span>}
                        </>
                      )}
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
            {/* 素材検索 */}
            <Input
              value={assetSearch}
              onChange={e => setAssetSearch(e.target.value)}
              placeholder="素材名で検索..."
              className="max-w-sm"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {(assetsQuery.data || []).filter((asset: any) => !assetSearch || asset.name.toLowerCase().includes(assetSearch.toLowerCase()) || (asset.category || "").toLowerCase().includes(assetSearch.toLowerCase())).map((asset: any) => (
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
                <div>
                  <label className="text-xs text-gray-500">値段</label>
                  <Input value={newAssetCategory} onChange={e => setNewAssetCategory(e.target.value)} placeholder="例: ¥3,980" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">画像ファイル (PNG推奨) *</label>
                  <input ref={fileInputRef} type="file" accept="image/*" className="block w-full text-sm mt-1 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                </div>
                {uploading && <div className="text-xs text-blue-600">アップロード中...</div>}
                <Button
                  className="w-full"
                  disabled={!newAssetName || uploading || !fileInputRef.current?.files?.length}
                  onClick={async () => {
                    const file = fileInputRef.current?.files?.[0];
                    if (!file || !newAssetName) { alert("商品名と画像ファイルを入力してください"); return; }
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
                        alert("素材を追加しました");
                        setNewAssetName(""); setNewAssetCategory(""); setNewAssetBrand("");
                        setUploadDialogOpen(false);
                      } else {
                        alert("アップロード失敗: " + (data.error || "不明なエラー"));
                      }
                    } catch (err) {
                      alert("アップロード失敗");
                    }
                    setUploading(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <Upload className="h-4 w-4 mr-2" />{uploading ? "アップロード中..." : "アップロード"}
                </Button>
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
