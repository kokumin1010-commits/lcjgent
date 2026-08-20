/**
 * Store Management - 店铺管理系统
 * Full-screen layout with store list, detail view, CSV upload, and data display
 */
import { useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { 
  Store, Upload, Plus, Trash2, Edit2, Users, TrendingUp, 
  BarChart3, ShoppingBag, Megaphone, ArrowLeft, X, Check,
  FileSpreadsheet, Calendar, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

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

  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());
  const [summaryMonth, setSummaryMonth] = useState(new Date().getMonth() + 1);
  const storesQuery = trpc.storeManagement.list.useQuery();
  const staffQuery = trpc.storeManagement.getStaffList.useQuery();
  const now = new Date();
  const summaryQuery = trpc.storeManagement.getAllSummary.useQuery({ year: summaryYear, month: summaryMonth });
  const rankedStores = useMemo(() => {
    if (!summaryQuery.data) return [];
    return [...summaryQuery.data].sort((a, b) => b.gmv - a.gmv);
  }, [summaryQuery.data]);
  const totalGmv = useMemo(() => rankedStores.reduce((s, r) => s + r.gmv, 0), [rankedStores]);
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


      {/* GMV Overview & Ranking */}
      {(storesQuery.data && storesQuery.data.length > 0) && (
        <div className="max-w-[1600px] mx-auto px-6 pb-6">
          {/* Total GMV Card */}
          <div className="bg-gradient-to-r from-orange-500 to-rose-500 rounded-2xl p-6 mb-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">全店铺GMV合計</p>
                <p className="text-3xl font-bold mt-1">{String.fromCharCode(165)}{totalGmv.toLocaleString()}</p>
                <p className="text-sm opacity-80 mt-1">{rankedStores.filter(s => s.gmv > 0).length} / {rankedStores.length} 店铺有数据</p>
              </div>
              <div className="flex items-center gap-2">
                <select value={summaryYear} onChange={e => setSummaryYear(Number(e.target.value))} className="bg-white/20 text-white border border-white/30 rounded-lg px-3 py-1.5 text-sm">
                  {[2024,2025,2026].map(y => <option key={y} value={y} className="text-black">{y}年</option>)}
                </select>
                <select value={summaryMonth} onChange={e => setSummaryMonth(Number(e.target.value))} className="bg-white/20 text-white border border-white/30 rounded-lg px-3 py-1.5 text-sm">
                  {Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m} className="text-black">{m}月</option>)}
                </select>
              </div>
            </div>
          </div>
          {/* GMV Ranking + Chart side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ranking Table */}
            <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-5">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-orange-500" /> GMV排行榜
              </h3>
              <div className="space-y-3">
                {rankedStores.map((store, idx) => (
                  <div key={store.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-yellow-400 text-white' : idx === 1 ? 'bg-gray-300 text-white' : idx === 2 ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{store.name}</p>
                      <p className="text-xs text-gray-500">{store.platform} - {store.operatorName || '-'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{String.fromCharCode(165)}{store.gmv.toLocaleString()}</p>
                      {store.gmvPct !== 0 && (
                        <p className={`text-xs ${store.gmvPct > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {store.gmvPct > 0 ? '+' : ''}{(store.gmvPct * 100).toFixed(1)}%
                        </p>
                      )}
                      {(store as any).returnRate !== undefined && (
                        <p className={`text-xs font-medium ${(store as any).returnRate <= 3 ? 'text-green-600' : (store as any).returnRate <= 8 ? 'text-orange-500' : 'text-red-500'}`}>
                          返品率: {(store as any).returnRate.toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* GMV Bar Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-5">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-orange-500" /> 店铺GMV对比
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rankedStores} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => v >= 10000 ? (v/10000).toFixed(0) + '万' : v.toString()} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [String.fromCharCode(165) + Number(v).toLocaleString(), 'GMV']} />
                  <Bar dataKey="gmv" fill="#f97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
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
  const now = new Date();
  const dataQuery = trpc.storeManagement.getData.useQuery({ storeId: store.id, year: now.getFullYear(), month: now.getMonth() + 1 });
  const shopData = dataQuery.data?.find((d: any) => d.dataType === 'shop_stats')?.data || [];
  const summary: any = shopData.find((r: any) => r._type === 'summary') || {};
  const gmvObj = summary['GMV'] || {};
  const ordersObj = summary['注文'] || summary['订单数'] || {};
  const customersObj = summary['カスタマー数'] || summary['客户数'] || {};
  const gmv = typeof gmvObj === 'object' ? (gmvObj.value || 0) : (gmvObj || 0);
  const gmvPct = typeof gmvObj === 'object' ? (gmvObj.pct || 0) : 0;
  const orders = typeof ordersObj === 'object' ? (ordersObj.value || 0) : (ordersObj || 0);
  const customers = typeof customersObj === 'object' ? (customersObj.value || 0) : (customersObj || 0);
  return (
    <div onClick={onClick} className="bg-white rounded-xl border border-orange-100 p-5 hover:shadow-lg hover:border-orange-300 transition-all cursor-pointer group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-lg overflow-hidden">
            {store.avatarUrl ? <img src={store.avatarUrl} alt="" className="w-full h-full object-cover" /> : (platform?.emoji || '🏪')}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{store.name}</h3>
            <p className="text-xs text-gray-500">{platform?.label} • {country?.label}</p>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); if(confirm('削除しますか？')) { deleteMutation.mutate({ id: store.id }, { onSuccess: () => utils.storeManagement.list.invalidate() }); } }}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {gmv > 0 ? (
        <div className="grid grid-cols-3 gap-2 my-2 py-2 border-t border-b border-gray-50">
          <div className="text-center">
            <p className="text-[10px] text-gray-400">GMV</p>
            <p className="text-xs font-bold text-orange-600">¥{Number(gmv).toLocaleString()}</p>
            {gmvPct !== 0 && <p className={`text-[10px] ${gmvPct > 0 ? 'text-green-500' : 'text-red-500'}`}>{gmvPct > 0 ? '↑' : '↓'}{Math.abs(gmvPct * 100).toFixed(1)}%</p>}
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-400">注文</p>
            <p className="text-xs font-bold text-blue-600">{Number(orders).toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-400">顧客</p>
            <p className="text-xs font-bold text-green-600">{Number(customers).toLocaleString()}</p>
          </div>
        </div>
      ) : (
        <div className="my-2 py-2 border-t border-b border-gray-50 text-center">
          <p className="text-[10px] text-gray-300">{dataQuery.isLoading ? '読込中...' : '当月データなし'}</p>
        </div>
      )}
      <div className="flex items-center gap-1.5 text-xs text-gray-600">
        <Users className="h-3.5 w-3.5 text-orange-400" />
        <span>{store.operatorName || '未指定'}</span>
        {store.operator2Name && <span className="text-gray-400">/ {store.operator2Name}</span>}
      </div>
    </div>
  );
}

function CreateStoreDialog({ staffList, onClose, onCreated }: { staffList: any[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', platform: 'tiktok_shop', country: 'japan', storeUrl: '', operatorId: 0, operatorName: '', operator2Id: 0, operator2Name: '', notes: '', avatarUrl: '' });
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
            {/* 店铺头像 */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-14 h-14 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer relative group"
                onClick={() => document.getElementById('avatar-input')?.click()}>
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-400 text-xs">头像</span>
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-white text-xs">上传</span>
                </div>
              </div>
              <input id="avatar-input" type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setForm(p => ({ ...p, avatarUrl: reader.result as string }));
                reader.readAsDataURL(file);
              }} />
              <span className="text-xs text-gray-400">点击上传店铺头像</span>
            </div>
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
  const deleteMutation = trpc.storeManagement.deleteData.useMutation({
    onSuccess: () => { utils.storeManagement.getData.invalidate(); }
  });
  const utils = trpc.useUtils();

  const shopStats = useMemo(() => dataQuery.data?.find(d => d.dataType === 'shop_stats')?.data || [], [dataQuery.data]);
  const productsData = useMemo(() => dataQuery.data?.find(d => d.dataType === 'products')?.data || [], [dataQuery.data]);
  const adsData = useMemo(() => dataQuery.data?.find(d => d.dataType === 'ads')?.data || [], [dataQuery.data]);

  // Parse Excel/CSV file with TikTok Shop format auto-detection
  const parseExcelFile = useCallback(async (file: File): Promise<{ data: Record<string, any>[]; dataType: 'shop_stats' | 'products' | 'ads' } | null> => {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (raw.length < 2) return null;

    // Auto-detect format by analyzing content
    const allText = raw.slice(0, 5).flat().join(' ').toLowerCase();
    const fileName = file.name.toLowerCase();

    // 1. 广告数据: has "cost", "roi", "campaign", "roas", "ad" in headers
    if (allText.includes('cost') || allText.includes('roi') || allText.includes('roas') || allText.includes('campaign') || fileName.includes('广告') || fileName.includes('ad')) {
      const headers = raw[0].map((h: any) => String(h || '').trim());
      const data = raw.slice(1).filter((r: any[]) => r.some(v => v !== '' && v !== null)).map((row: any[]) => {
        const obj: Record<string, any> = {};
        headers.forEach((h, i) => { 
          let val = row[i];
          if (h === '按天' && val instanceof Date) val = val.toISOString().split('T')[0];
          else if (h === '按天' && typeof val === 'string' && val.includes('00:00:00')) val = val.split(' ')[0];
          obj[h || `col_${i}`] = val ?? ''; 
        });
        return obj;
      });
      return { data, dataType: 'ads' };
    }

    // 2. 商品数据: has "商品名", "商品 ID", "product" in row 3-4, 176+ columns
    if (allText.includes('商品名') || allText.includes('商品 id') || allText.includes('product name') || allText.includes('product id') || fileName.includes('商品') || fileName.includes('product')) {
      // Find header row (row with "商品名")
      let headerIdx = raw.findIndex((r: any[]) => r.some((v: any) => String(v).includes('商品名')));
      if (headerIdx < 0) headerIdx = 3;
      const headers = raw[headerIdx].map((h: any) => String(h || '').trim());
      // Key columns to extract (first 30)
      const keyHeaders = headers.slice(0, 30).filter(h => h);
      const data = raw.slice(headerIdx + 1).filter((r: any[]) => r[0] && String(r[0]).trim()).map((row: any[]) => {
        const obj: Record<string, any> = {};
        keyHeaders.forEach((h, i) => { obj[h] = row[i] ?? ''; });
        return obj;
      });
      return { data, dataType: 'products' };
    }

    // 3. 店铺数据: has "GMV", "订单数", "注文", dates in DD/MM/YYYY format
    if (allText.includes('订单数') || allText.includes('注文') || allText.includes('カスタマー') || allText.includes('总计值') || allText.includes('総計') || fileName.includes('店铺') || fileName.includes('store') || (allText.includes('gmv') && !allText.includes('campaign') && !allText.includes('cost'))) {
      // Find the daily data header row - MUST be exact "日期" (not "分析日期" or "对比日期")
      let headerIdx = raw.findIndex((r: any[]) => {
        const v = String(r[0]).trim();
        return v === '日期' || v === '日付' || v === 'Date';
      });
      if (headerIdx < 0) {
        // Fallback: find row with "日期"/"日付" that doesn't contain "分析"/"対比"
        headerIdx = raw.findIndex((r: any[]) => {
          const s = String(r[0] || '');
          return (s.includes('日期') || s.includes('日付')) && !s.includes('分析') && !s.includes('对比') && !s.includes('対比');
        });
      }
      if (headerIdx < 0) headerIdx = 8;
      const headers = raw[headerIdx].map((h: any) => String(h || '').trim());
      
      // Find totals row (contains "总计"/"合計"/"Total" in col 0)
      const totalsIdx = raw.findIndex((r: any[]) => {
        const s = String(r[0] || '');
        return s.includes('总计') || s.includes('合計') || s.includes('総計') || s.includes('Total');
      });
      const totalsRow = totalsIdx >= 0 ? raw[totalsIdx] : [];
      // Find % change row
      const pctIdx = raw.findIndex((r: any[]) => {
        const s = String(r[0] || '');
        return s.includes('百分比') || s.includes('割合') || s.includes('変化率') || s.includes('Change');
      });
      const pctRow = pctIdx >= 0 ? raw[pctIdx] : [];
      // Find metric names row (has "GMV" or "注文" as a cell value)
      const metricRow = raw.findIndex((r: any[]) => r.some((v: any) => {
        const s = String(v).trim();
        return s === 'GMV' || s === '注文' || s === '订单数';
      }));
      const metricNames = metricRow >= 0 ? raw[metricRow].map((h: any) => String(h || '').trim()) : headers;
      
      // Build summary with totals + percentage
      const summary: Record<string, any> = { _type: 'summary' };
      for (let i = 1; i < metricNames.length; i++) {
        if (metricNames[i]) {
          const rv = totalsRow[i]; const rp = pctRow[i];
          const numVal = typeof rv === 'number' ? rv : parseFloat(String(rv || '0').replace(/[,%]/g, ''));
          let pctNum = 0;
          if (typeof rp === 'number') { pctNum = Math.abs(rp) < 10 ? rp : rp / 100; }
          else if (typeof rp === 'string' && rp.includes('%')) { pctNum = parseFloat(rp.replace('%', '')) / 100; }
          summary[metricNames[i]] = { value: isNaN(numVal) ? 0 : numVal, pct: isNaN(pctNum) ? 0 : pctNum };
        }
      }
      
      // Extract daily rows (after header, with date pattern DD/MM/YYYY or YYYY-MM-DD)
      const dailyData = raw.slice(headerIdx + 1).filter((r: any[]) => {
        const v = String(r[0] || '');
        return v.match(/^\d{2}\/\d{2}\/\d{4}$/) || v.match(/^\d{4}-\d{2}-\d{2}/) || v.match(/^\d{4}\/\d{2}\/\d{2}/);
      }).map((row: any[]) => {
        const obj: Record<string, any> = {};
        headers.forEach((h, i) => {
          if (h) {
            const v = row[i];
            if (typeof v === 'number') { obj[h] = v; }
            else if (typeof v === 'string' && v.match(/^-?[\d,.]+$/)) { obj[h] = parseFloat(v.replace(/,/g, '')); }
            else if (typeof v === 'string' && v === '-') { obj[h] = 0; }
            else { obj[h] = v ?? ''; }
          }
        });
        // Normalize date DD/MM/YYYY or YYYY/MM/DD → YYYY-MM-DD
        const dateKey = obj['日期'] !== undefined ? '日期' : (obj['日付'] !== undefined ? '日付' : 'Date');
        const dateVal = obj[dateKey];
        if (dateVal && String(dateVal).includes('/')) {
          const parts = String(dateVal).split('/');
          if (parts.length === 3) {
            if (parts[0].length === 4) { // YYYY/MM/DD
              obj['日期'] = `${parts[0]}-${parts[1]}-${parts[2]}`;
            } else { // DD/MM/YYYY
              obj['日期'] = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
          }
        }
        if (dateKey !== '日期' && obj[dateKey]) { obj['日期'] = obj['日期'] || obj[dateKey]; }
        return obj;
      });
      
      const data = [{ _type: 'summary', ...summary }, ...dailyData];
      return { data, dataType: 'shop_stats' as const };
    }

    return null;
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['csv', 'xlsx', 'xls'].includes(ext || '')) { 
        alert('CSV または Excel (.xlsx) ファイルのみ対応しています'); 
        continue; 
      }
      const result = await parseExcelFile(file);
      if (!result || result.data.length === 0) { 
        alert(`${file.name}: データを解析できませんでした`); 
        continue; 
      }
      await uploadMutation.mutateAsync({ 
        storeId: store.id, dataType: result.dataType, year, month, 
        data: result.data, fileName: file.name 
      });
      alert(`✅ ${file.name} アップロード完了\n種類: ${result.dataType === 'shop_stats' ? '店铺数据' : result.dataType === 'products' ? '商品数据' : '广告数据'}\nレコード数: ${result.data.length}件`);
    }
    utils.storeManagement.getData.invalidate();
  }, [store.id, year, month, parseExcelFile, uploadMutation, utils]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);



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
              <Upload className="h-4 w-4 mr-1" /> {showUpload ? '收起上传' : '📊 上传数据'}
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
            onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = '.csv,.xlsx,.xls'; input.multiple = true; input.onchange = (e) => handleFiles((e.target as HTMLInputElement).files!); input.click(); }}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-orange-500 bg-orange-50' : 'border-orange-200 bg-white hover:border-orange-400'}`}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-orange-400" />
            <p className="text-sm text-gray-600">拖放或点击上传（店铺/商品/广告 Excel(.xlsx) 或 CSV）</p>
            <p className="text-xs text-gray-400 mt-1">系统会自动识别TikTok Shop导出格式</p>
          </div>
        </div>
      )}

      {/* Data Display */}
      <div className="max-w-[1600px] mx-auto px-6 pb-8 space-y-4">
        {/* 店铺总览（全部訂單）- KPI cards with % change */}

        {/* Data management - delete uploaded data */}
        {dataQuery.data && dataQuery.data.length > 0 && (
          <div className="bg-white rounded-xl border border-orange-100 p-4">
            <h4 className="text-sm font-bold text-gray-700 mb-2">📁 已上传数据（{year}年{month}月）</h4>
            <div className="flex flex-wrap gap-2">
              {dataQuery.data.map((d: any) => (
                <div key={d.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-xs">
                  <span className={d.dataType === 'shop_stats' ? 'text-blue-600' : d.dataType === 'products' ? 'text-green-600' : 'text-purple-600'}>
                    {d.dataType === 'shop_stats' ? '📊 店铺数据' : d.dataType === 'products' ? '📦 商品数据' : '📢 广告数据'}
                  </span>
                  <span className="text-gray-400">({d.recordCount}条)</span>
                  {d.fileName && <span className="text-gray-400 max-w-[150px] truncate">{d.fileName}</span>}
                  <button
                    onClick={() => { if (confirm('确定删除此数据？删除后需重新上传。')) deleteMutation.mutate({ id: d.id }); }}
                    className="text-red-400 hover:text-red-600 ml-1 font-bold"
                    title="删除此数据"
                  >✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {shopStats.length > 0 && (() => {
          const summaryRow = shopStats.find((r: any) => r._type === 'summary');
          if (!summaryRow) return null;
          const metrics = Object.entries(summaryRow).filter(([k]) => k !== '_type' && k !== '日期');
          const colorMap: Record<number, string> = { 0: 'text-red-600', 1: 'text-blue-600', 2: 'text-green-600', 3: 'text-purple-600', 4: 'text-amber-600', 5: 'text-teal-600' };
          return (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                📊 店铺总览（全部訂單）
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {metrics.map(([key, val]: [string, any], idx) => {
                  const numVal = typeof val === 'object' ? val.value : val;
                  const pct = typeof val === 'object' ? val.pct : null;
                  const pctNum = typeof pct === 'number' ? pct : (typeof pct === 'string' ? parseFloat(pct) : null);
                  const isUp = pctNum !== null && pctNum > 0;
                  const isDown = pctNum !== null && pctNum < 0;
                  const displayVal = typeof numVal === 'number' 
                    ? (numVal < 1 && numVal > 0 ? (numVal * 100).toFixed(2) + '%' : numVal.toLocaleString())
                    : String(numVal || '-');
                  const pctDisplay = pctNum !== null && !isNaN(pctNum) && pctNum !== 0
                    ? `${isUp ? '↑' : '↓'}${Math.abs(pctNum * 100).toFixed(1)}%`
                    : pctNum === 0 ? '→0.0%' : '';
                  return (
                    <div key={key} className="bg-gray-50/80 rounded-lg p-3 border border-gray-100">
                      <p className="text-[10px] text-gray-500 mb-1 truncate" title={key}>{key}</p>
                      <p className={`text-lg font-bold ${colorMap[idx % 6]}`}>{displayVal}</p>
                      {pctDisplay && (
                        <p className={`text-[10px] mt-0.5 ${isUp ? 'text-green-600' : isDown ? 'text-red-600' : 'text-gray-500'}`}>{pctDisplay}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* 日别销售趋势（橘=直播）*/}
        {shopStats.length > 1 && (() => {
          const dailyData = shopStats.filter((r: any) => !r._type && r['日期']).sort((a: any, b: any) => String(a['日期']).localeCompare(String(b['日期'])));
          if (dailyData.length === 0) return null;
          const gmvKey = Object.keys(dailyData[0]).find(k => k === 'GMV' || k.includes('GMV')) || 'GMV';
          const liveKey = Object.keys(dailyData[0]).find(k => k.includes('达人直播归因') || k.includes('直播 GMV') || k.includes('达人直播 GMV')) || '';
          // Calculate 一般销售 = GMV - 直播GMV
          const chartData = dailyData.map((r: any) => {
            const total = Number(r[gmvKey]) || 0;
            const live = liveKey ? (Number(r[liveKey]) || 0) : 0;
            const dateStr = String(r['日期'] || '');
            const shortDate = dateStr.includes('-') ? dateStr.split('-').slice(1).join('/') : dateStr;
            return { date: shortDate, 一般销售: total - live, 直播销售: live };
          });
          return (
            <div className="bg-white rounded-xl border border-orange-100 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" /> 📈 日别销售趋势（橘=直播）
              </h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="日期" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 10000 ? `${(v/10000).toFixed(0)}万` : v.toLocaleString()} />
                    <Tooltip formatter={(v: any) => [`¥${Number(v).toLocaleString()}`, '']} />
                    <Bar dataKey={gmvKey} fill="#4F46E5" radius={[3, 3, 0, 0]} name="GMV" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })()}

        {/* 流量来源占比 - Pie chart from store summary data */}
        {shopStats.length > 0 && (() => {
          const summaryRow = shopStats.find((r: any) => r._type === 'summary');
          if (!summaryRow) return null;
          const COLORS = ['#FF8C42', '#4F7DF9', '#22C55E', '#8B5CF6', '#EF4444', '#06B6D4'];
          const trafficData = [
            { name: '商品卡', key: '商家商品卡 GMV' },
            { name: '直播', key: '达人直播归因 GMV' },
            { name: '短影音', key: '联盟视频归因 GMV' },
            { name: '联盟行销', key: '达人视频间接 GMV' },
            { name: '商家直播', key: '商家直播 GMV' },
            { name: '商家视频', key: '商家视频 GMV' },
          ].map(item => {
            const val = summaryRow[item.key];
            const numVal = typeof val === 'object' ? val.value : (typeof val === 'number' ? val : 0);
            return { name: item.name, value: numVal };
          }).filter(d => d.value > 0);
          const total = trafficData.reduce((s, d) => s + d.value, 0);
          if (total === 0) return null;
          const withPct = trafficData.map(d => ({ ...d, pct: ((d.value / total) * 100).toFixed(1) }));
          return (
            <div className="bg-white rounded-xl border border-orange-100 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                📊 流量来源占比
              </h3>
              <div className="flex items-center gap-8">
                <div className="w-[200px] h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={withPct} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={false}>
                        {withPct.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => [`¥${Number(v).toLocaleString()}`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2">
                  {withPct.map((d, idx) => (
                    <div key={d.name} className="flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                      <span className="text-gray-700">{d.name}</span>
                      <span className="font-bold text-gray-900 ml-2">{d.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* 最佳表现商品 - Product ranking table */}
        {productsData.length > 0 && (() => {
          // Sort by GMV descending
          const gmvKey = Object.keys(productsData[0]).find(k => k === 'GMV') || 'GMV';
          const sorted = [...productsData].sort((a: any, b: any) => {
            const va = typeof a[gmvKey] === 'number' ? a[gmvKey] : parseFloat(String(a[gmvKey] || '0').replace(/[¥円,]/g, ''));
            const vb = typeof b[gmvKey] === 'number' ? b[gmvKey] : parseFloat(String(b[gmvKey] || '0').replace(/[¥円,]/g, ''));
            return vb - va;
          });
          return (
            <div className="bg-white rounded-xl border border-orange-100 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                🏆 最佳表現商品（共 {sorted.length} 個）
              </h3>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-2 text-left font-semibold text-gray-700 whitespace-nowrap">#</th>
                      <th className="p-2 text-left font-semibold text-gray-700 whitespace-nowrap min-w-[250px]">商品</th>
                      <th className="p-2 text-right font-semibold text-red-600 whitespace-nowrap">銷售額↓</th>
                      <th className="p-2 text-right font-semibold text-gray-700 whitespace-nowrap">訂單</th>
                      <th className="p-2 text-right font-semibold text-gray-700 whitespace-nowrap">数量</th>
                      <th className="p-2 text-right font-semibold text-gray-700 whitespace-nowrap">訪客</th>
                      <th className="p-2 text-right font-semibold text-gray-700 whitespace-nowrap">曝光</th>
                      <th className="p-2 text-right font-semibold text-gray-700 whitespace-nowrap">點擊率</th>
                      <th className="p-2 text-right font-semibold text-blue-600 whitespace-nowrap">轉換率</th>
                      <th className="p-2 text-right font-semibold text-gray-700 whitespace-nowrap">加購</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row: any, i: number) => {
                      const name = row['商品名'] || row['商品'] || '-';
                      const gmv = row['GMV'] || row['销售额'] || 0;
                      const orders = row['订单数'] || row['訂單'] || '-';
                      const qty = row['商品成交件数'] || row['数量'] || '-';
                      const visitors = row['商品访客数'] || row['訪客'] || '-';
                      const exposure = row['商品曝光次数'] || row['曝光'] || '-';
                      const clickRate = row['商品点击率'] || row['點擊率'] || '-';
                      const convRate = row['CTOR（SKU 订单）'] || row['转化率'] || '-';
                      const addCart = row['加购次数'] || row['加購'] || '-';
                      const gmvDisplay = typeof gmv === 'number' ? `¥${gmv.toLocaleString()}` : String(gmv);
                      return (
                        <tr key={i} className="border-b border-gray-50 hover:bg-orange-50/30">
                          <td className="p-2 text-gray-400 font-medium">{i + 1}</td>
                          <td className="p-2 max-w-[300px] truncate" title={name}>{name}</td>
                          <td className="p-2 text-right font-bold text-red-600">{gmvDisplay}</td>
                          <td className="p-2 text-right">{typeof orders === 'number' ? orders.toLocaleString() : orders}</td>
                          <td className="p-2 text-right">{typeof qty === 'number' ? qty.toLocaleString() : qty}</td>
                          <td className="p-2 text-right">{typeof visitors === 'number' ? visitors.toLocaleString() : visitors}</td>
                          <td className="p-2 text-right">{typeof exposure === 'number' ? exposure.toLocaleString() : exposure}</td>
                          <td className="p-2 text-right">{clickRate}</td>
                          <td className="p-2 text-right text-blue-600 font-medium">{convRate}</td>
                          <td className="p-2 text-right">{typeof addCart === 'number' ? addCart.toLocaleString() : addCart}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}


        {/* Full Store Data Table */}
        {shopStats.length > 0 && (
          <div className="bg-white rounded-xl border border-orange-100 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-green-500" /> 店铺日别明细 ({shopStats.filter((r: any) => !r._type).length}天)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {Object.keys(shopStats.find((r: any) => !r._type) || {}).filter(h => h && h !== '_type').map(h => (
                      <th key={h} className="text-left p-2 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-100 last:border-r-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shopStats.filter((r: any) => !r._type).map((row: any, i: number) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/50">
                      {Object.keys(shopStats.find((r: any) => !r._type) || {}).filter(h => h && h !== '_type').map((k, j) => {
                        const v = row[k];
                        return (
                        <td key={j} className="p-2 whitespace-nowrap border-r border-gray-50 last:border-r-0">
                          {typeof v === 'number' ? v.toLocaleString() : String(v || '-')}
                        </td>
                      );})}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ads Table - Show ALL data */}
        {adsData.length > 0 && (
          <div className="bg-white rounded-xl border border-orange-100 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-green-500" /> 📢 广告分析
            </h3>
            {/* Ad Summary Cards */}
            {(() => {
              const totalCost = adsData.reduce((sum: number, r: any) => sum + (Number(r['Cost']) || 0), 0);
              const totalRevenue = adsData.reduce((sum: number, r: any) => sum + (Number(r['Gross revenue (Current shop)']) || 0), 0);
              const avgROI = totalCost > 0 ? totalRevenue / totalCost : 0;
              return (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-red-50 rounded-lg p-4 text-center border border-red-100">
                    <p className="text-xs text-gray-500">総花費</p>
                    <p className="text-xl font-bold text-red-600">¥{totalCost.toLocaleString()}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center border border-green-100">
                    <p className="text-xs text-gray-500">総銷售</p>
                    <p className="text-xl font-bold text-green-600">¥{totalRevenue.toLocaleString()}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100">
                    <p className="text-xs text-gray-500">平均ROAS</p>
                    <p className="text-xl font-bold text-blue-600">{avgROI.toFixed(2)}</p>
                  </div>
                </div>
              );
            })()}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {Object.keys(adsData[0] || {}).map(h => (
                      <th key={h} className="text-left p-2 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-100 last:border-r-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {adsData.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-green-50/50">
                      {Object.values(row).map((v: any, j: number) => (
                        <td key={j} className="p-2 whitespace-nowrap border-r border-gray-50 last:border-r-0">
                          {typeof v === 'number' ? v.toLocaleString() : String(v || '-')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Products Table - Show ALL data with horizontal scroll */}
        {productsData.length > 0 && (
          <div className="bg-white rounded-xl border border-orange-100 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-purple-500" /> 📦 综合商品排名 ({productsData.length}件)
            </h3>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left p-2 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-100">#</th>
                    {Object.keys(productsData[0] || {}).map(h => (
                      <th key={h} className="text-left p-2 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-100 last:border-r-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {productsData.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-purple-50/50">
                      <td className="p-2 text-gray-400 font-medium border-r border-gray-50">{i + 1}</td>
                      {Object.values(row).map((v: any, j: number) => (
                        <td key={j} className="p-2 whitespace-nowrap border-r border-gray-50 last:border-r-0 max-w-[250px] truncate" title={String(v || '')}>
                          {typeof v === 'number' ? v.toLocaleString() : String(v || '-')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
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
