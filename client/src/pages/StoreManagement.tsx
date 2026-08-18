/**
 * Store Management - 店铺管理系统
 * Full-screen layout with store list, detail view, CSV upload, and data display
 */
import { useState, useCallback, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { 
  Store, Upload, Plus, Trash2, Edit2, Users, TrendingUp, 
  BarChart3, ShoppingBag, Megaphone, ArrowLeft, X, Check,
  FileSpreadsheet, Calendar, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const PLATFORMS = [
  { value: 'tiktok_shop', label: 'TikTok Shop', emoji: '🎵' },
  { value: 'shopee', label: 'Shopee', emoji: '🛒' },
  { value: 'rakuten', label: '楽天', emoji: '🏪' },
  { value: 'amazon', label: 'Amazon', emoji: '📦' },
  { value: 'yahoo', label: 'Yahoo', emoji: '🟣' },
  { value: 'base', label: 'BASE', emoji: '🏠' },
  { value: 'other', label: 'その他', emoji: '🔗' },
];

const COUNTRIES = [
  { value: 'japan', label: '🇯🇵 日本' },
  { value: 'taiwan', label: '🇹🇼 台湾' },
  { value: 'thailand', label: '🇹🇭 タイ' },
  { value: 'singapore', label: '🇸🇬 シンガポール' },
  { value: 'other', label: '🌏 その他' },
];

const COLORS = ['#FF6B35', '#004E89', '#1A936F', '#F18F01', '#C73E1D', '#3C91E6'];

export default function StoreManagement() {
  const { user } = useAuth();
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');

  const storesQuery = trpc.storeManagement.list.useQuery();
  const staffQuery = trpc.storeManagement.getStaffList.useQuery();
  const utils = trpc.useUtils();

  const selectedStore = useMemo(() => 
    storesQuery.data?.find(s => s.id === selectedStoreId),
    [storesQuery.data, selectedStoreId]
  );

  if (selectedStoreId && selectedStore) {
    return (
      <StoreDetailView
        store={selectedStore}
        year={selectedYear}
        month={selectedMonth}
        viewMode={viewMode}
        onBack={() => setSelectedStoreId(null)}
        onYearChange={setSelectedYear}
        onMonthChange={setSelectedMonth}
        onViewModeChange={setViewMode}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-orange-100 px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Store className="h-7 w-7 text-orange-600" />
            <h1 className="text-2xl font-bold text-gray-900">店铺管理</h1>
            <span className="text-sm text-gray-500 ml-2">
              {storesQuery.data?.length || 0} 店铺
            </span>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4 mr-1" /> 添加店铺
          </Button>
        </div>
      </div>

      {/* Store Grid */}
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {storesQuery.data?.map(store => (
            <StoreCard
              key={store.id}
              store={store}
              onClick={() => setSelectedStoreId(store.id)}
              onEdit={() => {}}
              staffList={staffQuery.data || []}
            />
          ))}
        </div>
        {(!storesQuery.data || storesQuery.data.length === 0) && (
          <div className="text-center py-20 text-gray-500">
            <Store className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg">暂无店铺</p>
            <p className="text-sm mt-1">点击「添加店铺」开始管理</p>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      {showCreateDialog && (
        <CreateStoreDialog
          staffList={staffQuery.data || []}
          onClose={() => setShowCreateDialog(false)}
          onCreated={() => { setShowCreateDialog(false); utils.storeManagement.list.invalidate(); }}
        />
      )}
    </div>
  );
}

function StoreCard({ store, onClick, onEdit, staffList }: { store: any; onClick: () => void; onEdit: () => void; staffList: any[] }) {
  const platform = PLATFORMS.find(p => p.value === store.platform);
  const country = COUNTRIES.find(c => c.value === store.country);
  const deleteMutation = trpc.storeManagement.delete.useMutation();
  const utils = trpc.useUtils();

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-orange-100 p-5 hover:shadow-lg hover:border-orange-300 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{platform?.emoji || '🏪'}</span>
          <div>
            <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{store.name}</h3>
            <p className="text-xs text-gray-500">{platform?.label} • {country?.label}</p>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); if(confirm('删除此店铺？')) { deleteMutation.mutate({ id: store.id }, { onSuccess: () => utils.storeManagement.list.invalidate() }); } }}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* Operator */}
      <div className="flex items-center gap-1.5 text-xs text-gray-600 mt-3 pt-3 border-t border-gray-100">
        <Users className="h-3.5 w-3.5 text-orange-400" />
        <span>{store.operatorName || '未指定'}</span>
        {store.operator2Name && <span className="text-gray-400">/ {store.operator2Name}</span>}
      </div>
    </div>
  );
}

function CreateStoreDialog({ staffList, onClose, onCreated }: { staffList: any[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', platform: 'tiktok_shop', country: 'japan', storeUrl: '', operatorId: 0, operatorName: '', operator2Id: 0, operator2Name: '', notes: '' });
  const createMutation = trpc.storeManagement.create.useMutation({ onSuccess: onCreated });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">+ 添加店铺</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600">店铺名称 *</label>
            <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="例: KYOGOKU Official Store" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">平台</label>
              <select className="w-full border rounded-md p-2 text-sm" value={form.platform} onChange={e => setForm({...form, platform: e.target.value})}>
                {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.emoji} {p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">国家/地区</label>
              <select className="w-full border rounded-md p-2 text-sm" value={form.country} onChange={e => setForm({...form, country: e.target.value})}>
                {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">店铺链接</label>
            <Input value={form.storeUrl} onChange={e => setForm({...form, storeUrl: e.target.value})} placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">运营负责人</label>
              <select className="w-full border rounded-md p-2 text-sm" value={form.operatorId} onChange={e => { const s = staffList.find(x => x.id === Number(e.target.value)); setForm({...form, operatorId: Number(e.target.value), operatorName: s?.name || ''}); }}>
                <option value={0}>选择负责人</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">副运营</label>
              <select className="w-full border rounded-md p-2 text-sm" value={form.operator2Id} onChange={e => { const s = staffList.find(x => x.id === Number(e.target.value)); setForm({...form, operator2Id: Number(e.target.value), operator2Name: s?.name || ''}); }}>
                <option value={0}>选择副运营</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">备注</label>
            <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="备注信息..." />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button className="bg-orange-500 hover:bg-orange-600" disabled={!form.name || createMutation.isPending} onClick={() => createMutation.mutate({ ...form, operatorId: form.operatorId || undefined, operator2Id: form.operator2Id || undefined })}>
            {createMutation.isPending ? '创建中...' : '创建'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StoreDetailView({ store, year, month, viewMode, onBack, onYearChange, onMonthChange, onViewModeChange }: {
  store: any; year: number; month: number; viewMode: 'daily' | 'weekly';
  onBack: () => void; onYearChange: (y: number) => void; onMonthChange: (m: number) => void; onViewModeChange: (v: 'daily' | 'weekly') => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const platform = PLATFORMS.find(p => p.value === store.platform);
  const country = COUNTRIES.find(c => c.value === store.country);

  const dataQuery = trpc.storeManagement.getData.useQuery({ storeId: store.id, year, month });
  const uploadMutation = trpc.storeManagement.uploadData.useMutation();
  const utils = trpc.useUtils();

  const shopStats = useMemo(() => dataQuery.data?.find(d => d.dataType === 'shop_stats')?.data || [], [dataQuery.data]);
  const productsData = useMemo(() => dataQuery.data?.find(d => d.dataType === 'products')?.data || [], [dataQuery.data]);
  const adsData = useMemo(() => dataQuery.data?.find(d => d.dataType === 'ads')?.data || [], [dataQuery.data]);

  // Parse CSV file
  const parseCSV = useCallback((text: string): Record<string, string>[] => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ''; });
      return obj;
    });
  }, []);

  // Detect CSV type by headers
  const detectCSVType = useCallback((headers: string[]): 'shop_stats' | 'products' | 'ads' | null => {
    const h = headers.join(',').toLowerCase();
    if (h.includes('roas') || h.includes('广告') || h.includes('花費') || h.includes('點擊率') || h.includes('cpc') || h.includes('impression')) return 'ads';
    if (h.includes('sku') || h.includes('商品') || h.includes('parent') || h.includes('product')) return 'products';
    if (h.includes('銷售') || h.includes('訂單') || h.includes('訪客') || h.includes('轉換') || h.includes('sales') || h.includes('revenue')) return 'shop_stats';
    return null;
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (!file.name.endsWith('.csv')) { alert('CSVファイルのみ対応しています'); continue; }
      const text = await file.text();
      const data = parseCSV(text);
      if (data.length === 0) { alert(`${file.name}: データが空です`); continue; }
      const headers = Object.keys(data[0]);
      let dataType = detectCSVType(headers);
      if (!dataType) {
        const choice = prompt(`${file.name} のデータ種類を選択:\n1 = 店铺数据(shop_stats)\n2 = 商品数据(products)\n3 = 广告数据(ads)`);
        if (choice === '1') dataType = 'shop_stats';
        else if (choice === '2') dataType = 'products';
        else if (choice === '3') dataType = 'ads';
        else continue;
      }
      await uploadMutation.mutateAsync({ storeId: store.id, dataType, year, month, data, fileName: file.name });
      alert(`✅ ${file.name} アップロード完了 (${data.length}件)`);
    }
    utils.storeManagement.getData.invalidate();
  }, [store.id, year, month, parseCSV, detectCSVType, uploadMutation, utils]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  // Calculate KPIs from shop_stats
  const kpis = useMemo(() => {
    if (!shopStats.length) return null;
    const numVal = (row: any, keys: string[]) => {
      for (const k of keys) { if (row[k]) return parseFloat(String(row[k]).replace(/[,%NT$¥]/g, '')) || 0; }
      return 0;
    };
    let totalSales = 0, totalOrders = 0, totalVisitors = 0, totalClicks = 0;
    shopStats.forEach((row: any) => {
      totalSales += numVal(row, ['銷售額', '売上', 'sales', 'revenue', '總銷售額']);
      totalOrders += numVal(row, ['訂單', '注文', 'orders', '訂單數']);
      totalVisitors += numVal(row, ['訪客', '訪問者', 'visitors', '訪客數']);
      totalClicks += numVal(row, ['點擊數', 'clicks', '商品點擊數']);
    });
    return { totalSales, totalOrders, totalVisitors, totalClicks, avgOrderValue: totalOrders ? totalSales / totalOrders : 0, conversionRate: totalVisitors ? (totalOrders / totalVisitors * 100) : 0 };
  }, [shopStats]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-orange-100 px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-gray-500 hover:text-gray-800 p-1"><ArrowLeft className="h-5 w-5" /></button>
            <span className="text-2xl">{platform?.emoji}</span>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{store.name}</h1>
              <p className="text-xs text-gray-500">{country?.label} • {platform?.label} • 运营: {store.operatorName || '未指定'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowUpload(!showUpload)}>
              <Upload className="h-4 w-4 mr-1" /> {showUpload ? '收起上传' : '📊 上传CSV'}
            </Button>
          </div>
        </div>
      </div>

      {/* Time Selectors */}
      <div className="max-w-[1600px] mx-auto px-6 py-3">
        <div className="bg-white rounded-xl border border-orange-100 p-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex gap-1">
              <button onClick={() => onViewModeChange('daily')} className={`px-3 py-1 rounded text-xs font-medium ${viewMode === 'daily' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>日別</button>
              <button onClick={() => onViewModeChange('weekly')} className={`px-3 py-1 rounded text-xs font-medium ${viewMode === 'weekly' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>週別</button>
            </div>
            <div className="flex gap-1 ml-4">
              {[2024, 2025, 2026].map(y => (
                <button key={y} onClick={() => onYearChange(y)} className={`px-3 py-1 rounded text-xs font-medium ${year === y ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{y}年</button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <button key={m} onClick={() => onMonthChange(m)} className={`px-3 py-1.5 rounded text-xs font-medium ${month === m ? 'bg-purple-500 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>{m}月</button>
            ))}
          </div>
          <p className="text-xs text-orange-600 mt-2 font-medium">選択中: {year}年{month}月</p>
        </div>
      </div>

      {/* Upload Area */}
      {showUpload && (
        <div className="max-w-[1600px] mx-auto px-6 pb-3">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = '.csv'; input.multiple = true; input.onchange = (e) => handleFiles((e.target as HTMLInputElement).files!); input.click(); }}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-orange-500 bg-orange-50' : 'border-orange-200 bg-white hover:border-orange-400'}`}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-orange-400" />
            <p className="text-sm text-gray-600">拖放或点击上传（shop-stats / products / 广告CSV）</p>
            <p className="text-xs text-gray-400 mt-1">系统会自动识别CSV类型</p>
          </div>
        </div>
      )}

      {/* Data Display */}
      <div className="max-w-[1600px] mx-auto px-6 pb-8 space-y-4">
        {/* KPI Overview */}
        {kpis && (
          <div className="bg-white rounded-xl border border-orange-100 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-orange-500" /> 店铺总览
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <KPICard label="总销售额" value={`¥${kpis.totalSales.toLocaleString()}`} color="text-red-600" />
              <KPICard label="订单数" value={kpis.totalOrders.toLocaleString()} color="text-blue-600" />
              <KPICard label="均单价" value={`¥${kpis.avgOrderValue.toFixed(0)}`} color="text-green-600" />
              <KPICard label="访客数" value={kpis.totalVisitors.toLocaleString()} color="text-purple-600" />
              <KPICard label="点击数" value={kpis.totalClicks.toLocaleString()} color="text-amber-600" />
              <KPICard label="转换率" value={`${kpis.conversionRate.toFixed(2)}%`} color="text-teal-600" />
            </div>
          </div>
        )}

        {/* Daily Sales Chart */}
        {shopStats.length > 0 && (
          <div className="bg-white rounded-xl border border-orange-100 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" /> 日別销售趋势
            </h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shopStats.slice(0, 31)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey={Object.keys(shopStats[0] || {})[0]} tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey={Object.keys(shopStats[0] || {}).find(k => k.includes('銷售') || k.includes('売上') || k.includes('sales')) || 'sales'} fill="#FF6B35" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Ads Table */}
        {adsData.length > 0 && (
          <div className="bg-white rounded-xl border border-orange-100 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-green-500" /> 广告分析 ({adsData.length}条)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    {Object.keys(adsData[0] || {}).slice(0, 10).map(h => (
                      <th key={h} className="text-left p-2 font-medium text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {adsData.slice(0, 20).map((row: any, i: number) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-orange-50/50">
                      {Object.values(row).slice(0, 10).map((v: any, j: number) => (
                        <td key={j} className="p-2 whitespace-nowrap">{String(v || '-')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {adsData.length > 20 && <p className="text-xs text-gray-400 mt-2 text-center">显示前20条 / 共{adsData.length}条</p>}
            </div>
          </div>
        )}

        {/* Products Table */}
        {productsData.length > 0 && (
          <div className="bg-white rounded-xl border border-orange-100 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-purple-500" /> 商品数据 ({productsData.length}件)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    {Object.keys(productsData[0] || {}).slice(0, 12).map(h => (
                      <th key={h} className="text-left p-2 font-medium text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {productsData.slice(0, 30).map((row: any, i: number) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-orange-50/50">
                      {Object.values(row).slice(0, 12).map((v: any, j: number) => (
                        <td key={j} className="p-2 whitespace-nowrap max-w-[200px] truncate">{String(v || '-')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {productsData.length > 30 && <p className="text-xs text-gray-400 mt-2 text-center">显示前30条 / 共{productsData.length}条</p>}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!shopStats.length && !adsData.length && !productsData.length && (
          <div className="bg-white rounded-xl border border-orange-100 p-12 text-center">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">暂无 {year}年{month}月 的数据</p>
            <p className="text-sm text-gray-400 mt-1">点击「上传CSV」导入店铺/商品/广告数据</p>
          </div>
        )}
      </div>
    </div>
  );
}

function KPICard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
