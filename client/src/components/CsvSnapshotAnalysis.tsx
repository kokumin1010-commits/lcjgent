/**
 * CSV/Excel Snapshot Analysis Component
 * TikTok Shop商品データのアップロード・比較分析・AI分析
 */
import { useState, useRef, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, TrendingUp, TrendingDown, AlertTriangle, Brain, Loader2, Trash2, BarChart3, ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import * as XLSX from "xlsx";

interface CsvSnapshotAnalysisProps {
  livestreamId: number;
  liverId?: number | null;
  timeSlot: string;
}

// Column mapping from Chinese headers to internal field names
const COLUMN_MAP: Record<string, string> = {
  "商品 ID": "productId",
  "商品ID": "productId",
  "商品名称": "productName",
  "商品名": "productName",
  "归因 GMV": "gmv",
  "归因GMV": "gmv",
  "帰因GMV": "gmv",
  "归因成交件数": "orderCount",
  "帰因成交件数": "orderCount",
  "客户数": "customerCount",
  "客戶数": "customerCount",
  "平均订单金额": "avgOrderAmount",
  "平均注文金額": "avgOrderAmount",
  "归因 SKU 订单数": "skuOrderCount",
  "归因SKU订单数": "skuOrderCount",
  "帰因SKU注文数": "skuOrderCount",
  "归因订单数": "totalOrderCount",
  "帰因注文数": "totalOrderCount",
  "付款率": "paymentRate",
  "商品曝光次数": "impressionCount",
  "商品曝光次數": "impressionCount",
  "点击率": "clickRate",
  "クリック率": "clickRate",
  "加购次数": "cartAddCount",
  "加購次数": "cartAddCount",
  "点击成交转化率（SKU 订单）": "skuConversionRate",
  "点击成交转化率（SKU订单）": "skuConversionRate",
  "点击成交転化率(SKU)": "skuConversionRate",
  "点击成交转化率": "conversionRate",
  "点击成交転化率": "conversionRate",
  "千次观看成交金额": "gpm",
  "千次観看成交金額": "gpm",
  "GPM": "gpm",
  "商品点击次数": "clickCount",
  "商品クリック次数": "clickCount",
  "可用库存": "availableStock",
  "可用庫存": "availableStock",
};

function parseNumber(val: any): number {
  if (val === null || val === undefined || val === "" || val === "-") return 0;
  if (typeof val === "number") return val;
  const str = String(val).replace(/[,，\s¥￥]/g, "");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

type TabType = 'upload' | 'timeline' | 'compare' | 'analysis';

export default function CsvSnapshotAnalysis({ livestreamId, liverId, timeSlot }: CsvSnapshotAnalysisProps) {
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [compareIdA, setCompareIdA] = useState<string>("");
  const [compareIdB, setCompareIdB] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [expandedProducts, setExpandedProducts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: csvSnapshots, refetch: refetchSnapshots } = trpc.csvSnapshot.getCsvSnapshots.useQuery(
    { livestreamId },
    { enabled: livestreamId > 0 }
  );

  const { data: comparisonData } = trpc.csvSnapshot.compareCsvSnapshots.useQuery(
    { snapshotIdA: parseInt(compareIdA), snapshotIdB: parseInt(compareIdB) },
    { enabled: !!compareIdA && !!compareIdB && compareIdA !== compareIdB }
  );

  // Mutations
  const addCsvMutation = trpc.csvSnapshot.addCsvSnapshot.useMutation({
    onSuccess: (data) => {
      toast.success(`CSVアップロード完了！${data.snapshot.totalProducts}商品, GMV: ¥${data.snapshot.totalGmv.toLocaleString()}`);
      refetchSnapshots();
      setIsUploading(false);
    },
    onError: (err) => {
      toast.error(`アップロードエラー: ${err.message}`);
      setIsUploading(false);
    },
  });

  const deleteMutation = trpc.csvSnapshot.deleteCsvSnapshot.useMutation({
    onSuccess: () => {
      toast.success("スナップショットを削除しました");
      refetchSnapshots();
    },
    onError: (err) => toast.error(`削除エラー: ${err.message}`),
  });

  const analyzeMutation = trpc.csvSnapshot.analyzeCsvData.useMutation({
    onSuccess: (data) => {
      setAnalysisResult(data.analysis);
      setIsAnalyzing(false);
    },
    onError: (err) => {
      toast.error(`AI分析エラー: ${err.message}`);
      setIsAnalyzing(false);
    },
  });

  // File upload handler
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!allowedExtensions.includes(ext)) {
      toast.error('Excel (.xlsx, .xls) または CSV (.csv) ファイルを選択してください');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('ファイルサイズは10MB以下にしてください');
      return;
    }

    setIsUploading(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      if (rows.length < 2) {
        toast.error('データが空です（ヘッダー行のみ）');
        setIsUploading(false);
        return;
      }

      // Map headers
      const headers = rows[0] as string[];
      const fieldMapping: Record<number, string> = {};
      headers.forEach((h, idx) => {
        const trimmed = String(h).trim();
        if (COLUMN_MAP[trimmed]) {
          fieldMapping[idx] = COLUMN_MAP[trimmed];
        }
      });

      // Parse products
      const products: any[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const product: any = {};
        Object.entries(fieldMapping).forEach(([colIdx, field]) => {
          const val = row[parseInt(colIdx)];
          if (field === 'productId' || field === 'productName') {
            product[field] = val ? String(val).trim() : '';
          } else {
            product[field] = parseNumber(val);
          }
        });

        // Skip rows without product name
        if (!product.productName) continue;
        products.push(product);
      }

      if (products.length === 0) {
        toast.error('有効な商品データが見つかりませんでした。ヘッダー名を確認してください。');
        setIsUploading(false);
        return;
      }

      // Upload to server
      addCsvMutation.mutate({
        livestreamId,
        liverId: liverId || undefined,
        fileName: file.name,
        timeSlot,
        products,
      });
    } catch (err: any) {
      toast.error(`ファイル解析エラー: ${err.message || '不明なエラー'}`);
      setIsUploading(false);
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [livestreamId, liverId, timeSlot, addCsvMutation]);

  // Timeline chart data
  const timelineData = useMemo(() => {
    if (!csvSnapshots || csvSnapshots.length === 0) return [];
    return csvSnapshots.map(s => ({
      timeSlot: s.timeSlot,
      gmv: (s.totalGmv || 0) / 10000, // 万円表示
      orders: s.totalOrders || 0,
      products: s.totalProducts || 0,
      avgGpm: s.avgGpm || 0,
    }));
  }, [csvSnapshots]);

  // Auto-select comparison snapshots
  const handleAutoCompare = useCallback(() => {
    if (csvSnapshots && csvSnapshots.length >= 2) {
      setCompareIdA(String(csvSnapshots[csvSnapshots.length - 2].id));
      setCompareIdB(String(csvSnapshots[csvSnapshots.length - 1].id));
      setActiveTab('compare');
    }
  }, [csvSnapshots]);

  // AI Analysis
  const handleAnalyze = useCallback(() => {
    setIsAnalyzing(true);
    setAnalysisResult("");
    analyzeMutation.mutate({ livestreamId });
  }, [livestreamId, analyzeMutation]);

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: 'upload', label: 'アップロード', icon: Upload },
    { key: 'timeline', label: 'GMV推移', icon: TrendingUp },
    { key: 'compare', label: '比較分析', icon: ArrowUpDown },
    { key: 'analysis', label: 'AI分析', icon: Brain },
  ];

  return (
    <Card className="bg-gray-900 border-emerald-700/50">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            📊 CSV/Excel商品分析
          </h3>
          {csvSnapshots && csvSnapshots.length > 0 && (
            <span className="text-[10px] text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded">
              {csvSnapshots.length}件のデータ
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-3 overflow-x-auto">
          {tabs.map(tab => (
            <Button
              key={tab.key}
              size="sm"
              variant={activeTab === tab.key ? 'default' : 'ghost'}
              className={`text-[10px] h-7 px-2 whitespace-nowrap ${activeTab === tab.key ? 'bg-emerald-600' : 'text-gray-400'}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <tab.icon className="h-3 w-3 mr-1" />
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 text-base"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" />解析中...</>
              ) : (
                <><FileSpreadsheet className="h-5 w-5 mr-2" />TikTok商品データをアップロード</>
              )}
            </Button>
            <p className="text-[10px] text-gray-500 text-center">
              TikTok Shop管理画面 → 商品分析 → Excelエクスポートしたファイルをアップロード
            </p>
            <p className="text-[10px] text-emerald-400 text-center font-medium">
              📈 複数回アップロードすると時系列比較が可能になります
            </p>

            {/* Snapshot History */}
            {csvSnapshots && csvSnapshots.length > 0 && (
              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400 font-bold">アップロード履歴 ({csvSnapshots.length}件)</p>
                  {csvSnapshots.length >= 2 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[10px] h-6 text-emerald-400 hover:text-emerald-300"
                      onClick={handleAutoCompare}
                    >
                      最新2件を比較 →
                    </Button>
                  )}
                </div>
                {csvSnapshots.slice().reverse().map(snap => (
                  <div key={snap.id} className="bg-gray-800/50 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-emerald-300">{snap.timeSlot}</span>
                        <span className="text-[9px] text-gray-500">{snap.fileName}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0 text-gray-500 hover:text-red-400"
                        onClick={() => {
                          if (confirm('このスナップショットを削除しますか？')) {
                            deleteMutation.mutate({ snapshotId: snap.id });
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-1 mt-1.5">
                      <div className="text-center">
                        <p className="text-[9px] text-gray-500">GMV</p>
                        <p className="text-[10px] text-green-400 font-bold">¥{((snap.totalGmv || 0)).toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-gray-500">注文数</p>
                        <p className="text-[10px] text-white">{snap.totalOrders || 0}件</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-gray-500">商品数</p>
                        <p className="text-[10px] text-white">{snap.totalProducts || 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-gray-500">平均GPM</p>
                        <p className="text-[10px] text-purple-400">¥{(snap.avgGpm || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div>
            {timelineData.length > 0 ? (
              <div className="space-y-3">
                {/* GMV Timeline Chart */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">GMV推移 (万円)</p>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timelineData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="timeSlot" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff', fontSize: 12 }}
                          formatter={(value: any, name: string) => {
                            if (name === 'gmv') return [`¥${(value * 10000).toLocaleString()}`, 'GMV'];
                            return [value, name];
                          }}
                        />
                        <Line type="monotone" dataKey="gmv" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: '#10b981' }} name="gmv" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                {/* Orders & GPM Chart */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">注文数 & 平均GPM</p>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timelineData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="timeSlot" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff', fontSize: 12 }}
                        />
                        <Line yAxisId="left" type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} name="注文数" />
                        <Line yAxisId="right" type="monotone" dataKey="avgGpm" stroke="#a855f7" strokeWidth={2} dot={{ r: 3, fill: '#a855f7' }} name="平均GPM (¥)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <BarChart3 className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">CSVをアップロードするとGMV推移チャートが表示されます</p>
              </div>
            )}
          </div>
        )}

        {/* Compare Tab */}
        {activeTab === 'compare' && (
          <div className="space-y-3">
            {csvSnapshots && csvSnapshots.length >= 2 ? (
              <>
                {/* Snapshot Selection */}
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <p className="text-[9px] text-gray-500 mb-1">前</p>
                    <Select value={compareIdA} onValueChange={setCompareIdA}>
                      <SelectTrigger className="h-8 bg-gray-800 border-gray-700 text-xs text-white">
                        <SelectValue placeholder="選択..." />
                      </SelectTrigger>
                      <SelectContent>
                        {csvSnapshots.map(s => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.timeSlot} ({s.totalProducts}商品)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="text-gray-500 text-xs mt-4">→</span>
                  <div className="flex-1">
                    <p className="text-[9px] text-gray-500 mb-1">後</p>
                    <Select value={compareIdB} onValueChange={setCompareIdB}>
                      <SelectTrigger className="h-8 bg-gray-800 border-gray-700 text-xs text-white">
                        <SelectValue placeholder="選択..." />
                      </SelectTrigger>
                      <SelectContent>
                        {csvSnapshots.map(s => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.timeSlot} ({s.totalProducts}商品)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Comparison Results */}
                {comparisonData && (
                  <div className="space-y-3">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                        <p className="text-[9px] text-gray-500">GMV増加</p>
                        <p className={`text-sm font-bold ${(comparisonData.summary.totalGmvGrowth || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(comparisonData.summary.totalGmvGrowth || 0) >= 0 ? '+' : ''}¥{(comparisonData.summary.totalGmvGrowth || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                        <p className="text-[9px] text-gray-500">注文増加</p>
                        <p className={`text-sm font-bold ${(comparisonData.summary.totalOrderGrowth || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(comparisonData.summary.totalOrderGrowth || 0) >= 0 ? '+' : ''}{comparisonData.summary.totalOrderGrowth || 0}件
                        </p>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                        <p className="text-[9px] text-gray-500">成長商品</p>
                        <p className="text-sm font-bold text-blue-400">{comparisonData.summary.improvedProducts || 0}件</p>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                        <p className="text-[9px] text-gray-500">下降商品</p>
                        <p className="text-sm font-bold text-orange-400">{comparisonData.summary.declinedProducts || 0}件</p>
                      </div>
                    </div>

                    {/* Product Comparison Table */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-400 font-bold">商品別比較</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[10px] h-6 text-gray-400"
                          onClick={() => setExpandedProducts(!expandedProducts)}
                        >
                          {expandedProducts ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {expandedProducts ? '折りたたむ' : '全て表示'}
                        </Button>
                      </div>
                      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                        {(expandedProducts ? comparisonData.comparison : comparisonData.comparison.slice(0, 8)).map((item, idx) => (
                          <div key={idx} className="bg-gray-800/30 rounded px-2 py-1.5 flex items-center gap-2">
                            {/* Rank change indicator */}
                            <div className="w-5 text-center shrink-0">
                              {item.isNew ? (
                                <span className="text-[9px] text-blue-400 font-bold">NEW</span>
                              ) : item.rankChange > 0 ? (
                                <span className="text-[9px] text-green-400">↑{item.rankChange}</span>
                              ) : item.rankChange < 0 ? (
                                <span className="text-[9px] text-red-400">↓{Math.abs(item.rankChange)}</span>
                              ) : (
                                <span className="text-[9px] text-gray-500">-</span>
                              )}
                            </div>
                            {/* Product name */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-white truncate">{item.productName}</p>
                            </div>
                            {/* GMV delta */}
                            <div className="text-right shrink-0">
                              <p className={`text-[10px] font-bold ${item.gmvDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {item.gmvDelta >= 0 ? '+' : ''}¥{item.gmvDelta.toLocaleString()}
                              </p>
                              <p className="text-[8px] text-gray-500">
                                注文{item.orderDelta >= 0 ? '+' : ''}{item.orderDelta}
                              </p>
                            </div>
                            {/* Stock alert */}
                            {item.availableStock <= 5 && item.availableStock > 0 && (
                              <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" title={`在庫残${item.availableStock}`} />
                            )}
                            {item.availableStock === 0 && (
                              <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" title="在庫切れ" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Stock Alerts */}
                    {comparisonData.comparison.filter(c => c.availableStock <= 5 && c.gmv > 0).length > 0 && (
                      <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-2">
                        <p className="text-[10px] text-amber-400 font-bold mb-1">⚠️ 在庫アラート</p>
                        {comparisonData.comparison
                          .filter(c => c.availableStock <= 5 && c.gmv > 0)
                          .slice(0, 5)
                          .map((item, idx) => (
                            <p key={idx} className="text-[9px] text-amber-300">
                              • {item.productName.substring(0, 30)}... (残{item.availableStock}個, GMV: ¥{item.gmv.toLocaleString()})
                            </p>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <ArrowUpDown className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">2回以上CSVをアップロードすると比較分析が可能になります</p>
              </div>
            )}
          </div>
        )}

        {/* AI Analysis Tab */}
        {activeTab === 'analysis' && (
          <div className="space-y-3">
            <Button
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold h-10"
              onClick={handleAnalyze}
              disabled={isAnalyzing || !csvSnapshots || csvSnapshots.length === 0}
            >
              {isAnalyzing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />AI分析中...</>
              ) : (
                <><Brain className="h-4 w-4 mr-2" />AIデータ分析を実行</>
              )}
            </Button>
            {!csvSnapshots || csvSnapshots.length === 0 ? (
              <p className="text-[10px] text-gray-500 text-center">CSVデータをアップロードしてからAI分析を実行してください</p>
            ) : (
              <p className="text-[10px] text-gray-500 text-center">
                {csvSnapshots.length}件のスナップショットデータを基にAIが分析します
              </p>
            )}
            {analysisResult && (
              <div className="bg-gray-800/50 rounded-lg p-3 max-h-[400px] overflow-y-auto">
                <p className="text-[10px] text-purple-400 font-bold mb-2">🤖 AI分析結果</p>
                <div className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {analysisResult}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
