/**
 * LCF Admin - Live Commerce Festival 専用管理画面
 * /lcf/admin でアクセス可能
 * lcf_token (role=admin) で認証
 */
import { useState, useEffect, useRef, useRef } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import {
  LayoutDashboard, Users, Building2, Mic2, Calendar, Trophy,
  Search, Download, Eye, CheckCircle, XCircle, Clock, Loader2,
  LogOut, Settings, MessageCircle, UserPlus, Activity, QrCode, ScanLine
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

type MainTab = "dashboard" | "applications" | "event" | "sponsors" | "accounts" | "activity" | "checkin";
type AppTab = "company" | "liver" | "general";
type StatusType = "new" | "confirmed" | "rejected" | "cancelled";

const STATUS_CONFIG: Record<StatusType, { label: string; color: string; icon: any }> = {
  new: { label: "申込済み", color: "bg-blue-100 text-blue-800", icon: Clock },
  confirmed: { label: "参加確定", color: "bg-green-100 text-green-800", icon: CheckCircle },
  rejected: { label: "無効", color: "bg-red-100 text-red-800", icon: XCircle },
  cancelled: { label: "キャンセル", color: "bg-gray-100 text-gray-800", icon: XCircle },
};


// ===== CheckIn Tab Component =====
function CheckInTab() {
  const [scanMode, setScanMode] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastResult, setLastResult] = useState<{success: boolean; message: string; ticket?: any} | null>(null);
  
  const ticketsQuery = trpc.festival.listTickets.useQuery({ search: searchQuery || undefined });
  const batchGenMut = trpc.festival.batchGenerateTickets.useMutation({
    onSuccess: (data) => {
      setLastResult({ success: true, message: `✅ ${data.generated}件のチケットを一括生成しました` });
      ticketsQuery.refetch();
    },
    onError: (err) => {
      setLastResult({ success: false, message: `❌ ${err.message}` });
    },
  });
  const checkInMut = trpc.festival.checkIn.useMutation({
    onSuccess: (data) => {
      setLastResult({ success: true, message: `✅ 签到成功！ ${data.ticket.applicantName}`, ticket: data.ticket });
      ticketsQuery.refetch();
    },
    onError: (err) => {
      setLastResult({ success: false, message: `❌ ${err.message}` });
    },
  });

  const handleManualCheckIn = () => {
    if (!manualInput.trim()) return;
    checkInMut.mutate({ ticketId: manualInput.trim() });
    setManualInput("");
  };


  // QR Scanner - use ref to persist scanner instance across renders
  const scannerRef = useRef<any>(null);
  const scannerRunningRef = useRef(false);
  useEffect(() => {
    if (!scanMode) return;
    let cancelled = false;
    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        const scanner = new Html5Qrcode('qr-reader-container');
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            if (decodedText && decodedText.startsWith('LCF-')) {
              checkInMut.mutate({ ticketId: decodedText });
              // Stop scanner first, then update state
              scanner.stop().catch(() => {}).finally(() => {
                scannerRef.current = null;
                scannerRunningRef.current = false;
                setScanMode(false);
              });
            }
          },
          () => {} // ignore errors during scanning
        );
        scannerRunningRef.current = true;
      } catch (err) {
        setLastResult({ success: false, message: '❌ カメラにアクセスできません。権限を確認してください。' });
        setScanMode(false);
      }
    };
    startScanner();
    return () => {
      cancelled = true;
      if (scannerRef.current && scannerRunningRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
        scannerRunningRef.current = false;
      }
    };
  }, [scanMode]);

  const tickets = ticketsQuery.data || [];
  const checkedInCount = tickets.filter((t: any) => t.checkedIn === 1).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
          <p className="text-2xl font-bold text-blue-600">{tickets.length}</p>
          <p className="text-xs text-gray-500">総チケット数</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
          <p className="text-2xl font-bold text-green-600">{checkedInCount}</p>
          <p className="text-xs text-gray-500">签到済み</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
          <p className="text-2xl font-bold text-orange-600">{tickets.length - checkedInCount}</p>
          <p className="text-xs text-gray-500">未签到</p>
        </div>
      </div>

      {/* Batch Generate */}
      <div className="flex justify-end">
        <button
          onClick={() => { if (confirm('未発行の全申込者にチケットを一括生成しますか？')) batchGenMut.mutate(); }}
          disabled={batchGenMut.isPending}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
        >
          {batchGenMut.isPending ? "生成中..." : "🎫 未発行者に一括チケット生成"}
        </button>
      </div>


      {/* QR Scanner */}
      <div className="bg-white rounded-xl p-5 shadow-sm border">
        <h3 className="font-bold text-lg mb-3 text-gray-900 flex items-center gap-2"><QrCode className="w-5 h-5" /> 📷 QRコードスキャン</h3>
        {!scanMode ? (
          <button
            onClick={() => setScanMode(true)}
            className="w-full bg-blue-600 text-white py-4 rounded-xl text-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            📷 カメラで签到スキャン
          </button>
        ) : (
          <div>
            <div id="qr-reader-container" className="rounded-xl overflow-hidden mb-3" style={{minHeight: '300px'}} />
            <button
              onClick={() => {
              // Stop scanner first, then hide
              if (scannerRef.current && scannerRunningRef.current) {
                scannerRef.current.stop().catch(() => {}).finally(() => {
                  scannerRef.current = null;
                  scannerRunningRef.current = false;
                  setScanMode(false);
                });
              } else {
                setScanMode(false);
              }
            }}
              className="w-full bg-red-500 text-white py-2 rounded-lg font-medium"
            >
              スキャン停止
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">※ QRコードをカメラに映してください。自動的に読み取ります。</p>
          </div>
        )}
      </div>

      {/* Manual Check-in */}
      <div className="bg-white rounded-xl p-5 shadow-sm border">
        <h3 className="font-bold text-lg mb-3 flex items-center gap-2"><ScanLine className="w-5 h-5" /> 手動签到</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualCheckIn()}
            placeholder="チケットID（例: LCF-XXXXXXXX）"
            className="flex-1 border rounded-lg px-3 py-2 text-sm text-gray-900"
          />
          <button
            onClick={handleManualCheckIn}
            disabled={checkInMut.isPending}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {checkInMut.isPending ? "処理中..." : "签到"}
          </button>
        </div>
        {lastResult && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${lastResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {lastResult.message}
          </div>
        )}
      </div>

      {/* Ticket List */}
      <div className="bg-white rounded-xl p-5 shadow-sm border">
        <h3 className="font-bold text-lg mb-3">チケット一覧</h3>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="名前・メール・チケットIDで検索..."
          className="w-full border rounded-lg px-3 py-2 text-sm mb-3 text-gray-900"
        />
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-xs text-gray-900">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left">チケットID</th>
                <th className="px-2 py-2 text-left">名前</th>
                <th className="px-2 py-2 text-left">区分</th>
                <th className="px-2 py-2 text-left">メール</th>
                <th className="px-2 py-2 text-center">状態</th>
                <th className="px-2 py-2 text-left">签到時間</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t: any) => (
                <tr key={t.id} className={`border-t ${t.checkedIn ? 'bg-green-50' : ''}`}>
                  <td className="px-2 py-2 font-mono text-[11px]">{t.ticketId}</td>
                  <td className="px-2 py-2 font-medium">{t.applicantName}</td>
                  <td className="px-2 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${t.applicantType === 'liver' ? 'bg-purple-100 text-purple-700' : t.applicantType === 'company' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                      {t.applicantType === 'liver' ? 'ライバー' : t.applicantType === 'company' ? '企業' : '一般'}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-gray-500">{t.applicantEmail}</td>
                  <td className="px-2 py-2 text-center">
                    {t.checkedIn ? <span className="text-green-600 font-bold">✓</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-2 py-2 text-gray-500">{t.checkedInAt ? new Date(t.checkedInAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</td>
                  <td className="px-2 py-2">
                    {!t.checkedIn && (
                      <button
                        onClick={() => checkInMut.mutate({ ticketId: t.ticketId })}
                        className="bg-green-500 text-white px-2 py-1 rounded text-[10px] hover:bg-green-600"
                      >
                        签到
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


export default function LcfAdmin() {
  const [, setLocation] = useLocation();
  const { data: me, isLoading: meLoading } = trpc.festivalAuth.me.useQuery();
  const logoutMutation = trpc.festivalAuth.logout.useMutation({
    onSuccess: () => setLocation("/lcf/login"),
  });

  // Redirect if not admin
  useEffect(() => {
    if (!meLoading && (!me || me.role !== "admin")) {
      setLocation("/lcf/login");
    }
  }, [me, meLoading, setLocation]);

  const [mainTab, setMainTab] = useState<MainTab>("dashboard");

  if (meLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!me || me.role !== "admin") return null;

  const mainTabs = [
    { key: "dashboard" as MainTab, label: "ダッシュボード", icon: LayoutDashboard },
    { key: "applications" as MainTab, label: "申込管理", icon: Users },
    { key: "event" as MainTab, label: "イベント設定", icon: Calendar },
    { key: "sponsors" as MainTab, label: "スポンサー", icon: Trophy },
    { key: "accounts" as MainTab, label: "アカウント", icon: UserPlus },
    { key: "activity" as MainTab, label: "操作履歴", icon: Activity },
    { key: "checkin" as MainTab, label: "签到管理", icon: QrCode },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="w-full mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-black font-bold text-sm">LCF</span>
            </div>
            <div>
              <h1 className="text-lg font-bold">LCF 管理画面</h1>
              <p className="text-xs text-gray-400">Live Commerce Festival 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">{me.displayName}</span>
            <Button variant="ghost" size="sm" onClick={() => logoutMutation.mutate()} className="text-gray-400 hover:text-white">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="w-full mx-auto px-6 py-4">
        <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
          {mainTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setMainTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                mainTab === tab.key
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-sm"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="w-full mx-auto px-6 pb-8">
        {mainTab === "dashboard" && <DashboardPanel />}
        {mainTab === "applications" && <ApplicationsPanel />}
        {mainTab === "event" && <EventPanel />}
        {mainTab === "sponsors" && <SponsorsPanel />}
        {mainTab === "accounts" && <AccountsPanel />}
        {mainTab === "activity" && <ActivityLogPanel />}
      {/* ===== 签到管理 Tab ===== */}
      {mainTab === "checkin" && <CheckInTab />}
      </div>
    </div>
  );
}

// ===== Dashboard =====
function DashboardPanel() {
  const { data: stats } = trpc.festival.stats.useQuery({ eventYear: "2026" });
  const { data: lineCount } = trpc.festival.lineRegistrationCount.useQuery({ eventYear: "2026" });
  const { data: sponsors } = trpc.festival.listSponsors.useQuery({ eventYear: "2026" });
  const confirmedSponsors = sponsors?.filter((s: any) => s.status === "confirmed").length || 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-400">企業申込</p>
            <p className="text-3xl font-bold text-blue-400">{stats?.company || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-400">ライバー申込</p>
            <p className="text-3xl font-bold text-pink-400">{stats?.liver || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-400">一般参加</p>
            <p className="text-3xl font-bold text-green-400">{stats?.general || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-400">LINE登録</p>
            <p className="text-3xl font-bold text-emerald-400">{lineCount?.count || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-400">スポンサー</p>
            <p className="text-3xl font-bold text-purple-400">{confirmedSponsors}</p>
          </CardContent>
        </Card>
      </div>
      <Card className="bg-gradient-to-r from-amber-900/30 to-orange-900/30 border-amber-500/30">
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-amber-300 font-medium">総申込数</p>
            <p className="text-4xl font-bold text-amber-100">{stats?.total || 0} <span className="text-lg">件</span></p>
          </div>
          <Trophy className="h-12 w-12 text-amber-400/50" />
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Applications =====
function ApplicationsPanel() {
  const [activeTab, setActiveTab] = useState<AppTab>("company");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailDialog, setDetailDialog] = useState<{ type: AppTab; data: any } | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ type: AppTab; id: number; currentStatus: string } | null>(null);
  const [newStatus, setNewStatus] = useState<StatusType>("confirmed");
  const [statusNotes, setStatusNotes] = useState("");

  const { data: stats } = trpc.festival.stats.useQuery({ eventYear: "2026" });
  const { data: companyList, isLoading: companyLoading } = trpc.festival.listCompany.useQuery({ eventYear: "2026" });
  const { data: liverList, isLoading: liverLoading } = trpc.festival.listLiver.useQuery({ eventYear: "2026" });
  const { data: generalList, isLoading: generalLoading } = trpc.festival.listGeneral.useQuery({ eventYear: "2026" });
  const utils = trpc.useUtils();

  const updateStatus = trpc.festival.updateStatus.useMutation({
    onSuccess: () => {
      utils.festival.listCompany.invalidate();
      utils.festival.listLiver.invalidate();
      utils.festival.listGeneral.invalidate();
      utils.festival.stats.invalidate();
      setStatusDialog(null);
    },
  });

  const handleStatusUpdate = () => {
    if (!statusDialog) return;
    updateStatus.mutate({
      type: statusDialog.type,
      id: statusDialog.id,
      status: newStatus,
      notes: statusNotes || undefined,
    });
  };

  const filterData = (data: any[] | undefined) => {
    if (!data) return [];
    let filtered = data;
    if (statusFilter !== "all") filtered = filtered.filter((d: any) => d.status === statusFilter);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((d: any) =>
        Object.values(d).some((v) => typeof v === "string" && v.toLowerCase().includes(term))
      );
    }
    return filtered;
  };

  const exportCsv = (type: AppTab) => {
    let data: any[] = [];
    let headers: string[] = [];
    let filename = "";
    if (type === "company") {
      data = companyList || [];
      headers = ["ID", "会社名", "担当者", "部署", "メール", "電話", "TikTokShopセラー名", "ブランド紹介", "LINE/Lark", "ステータス", "签到", "申込日"];
      filename = "lcf_company_applications.csv";
      data = data.map(d => [d.id, d.companyName, d.contactName, d.contactDepartment || "", d.email, d.phone, d.tiktokShopSellerName || "", d.brandIntro || "", d.lineOrLark || "", STATUS_CONFIG[d.status as StatusType]?.label, new Date(d.createdAt).toLocaleDateString("ja-JP")]);
    } else if (type === "liver") {
      data = liverList || [];
      headers = ["ID", "名前", "ライバー名", "事務所", "メール", "電話", "アカウント", "ジャンル", "LINE/Lark", "日程", "マッチ", "TikTokShopセラー名", "ブランド紹介", "TikTokShop URL", "マッチング希望商品", "ステータス", "签到", "申込日"];
      filename = "lcf_liver_applications.csv";
      data = data.map(d => [d.id, d.name, d.liverName, d.agency || "", d.email, d.phone, d.accountInfo || "", d.genre || "", d.lineOrLark || "", d.attendanceSchedule === "both_days" ? "両日" : d.attendanceSchedule === "day1_only" ? "8日" : d.attendanceSchedule === "day2_only" ? "9日" : "-", d.matchingPreference === "yes" ? "○" : "×", d.tiktokShopSellerName || "", d.brandIntro || "", d.tiktokShopUrl || "", d.matchingProducts || "", STATUS_CONFIG[d.status as StatusType]?.label, new Date(d.createdAt).toLocaleDateString("ja-JP")]);
    } else {
      data = generalList || [];
      headers = ["ID", "名前", "会社名", "部署", "メール", "電話", "参加形態", "日程", "来場目的", "LINE/Lark", "ブランド名", "業種", "ステータス", "签到", "申込日"];
      filename = "lcf_general_applications.csv";
      data = data.map(d => [d.id, d.name, d.companyName || "", d.department || "", d.email, d.phone, d.participationType === "corporate" ? "法人" : "個人", d.attendanceSchedule === "both_days" ? "両日" : d.attendanceSchedule === "day1_only" ? "8日" : d.attendanceSchedule === "day2_only" ? "9日" : "-", (d.visitPurposes || []).join("; "), d.lineOrLark || "", d.brandName || "", (d.industryTypes || []).join("; "), STATUS_CONFIG[d.status as StatusType]?.label, new Date(d.createdAt).toLocaleDateString("ja-JP")]);
    }
    const bom = "\uFEFF";
    const csv = bom + [headers.join(","), ...data.map(row => row.map((cell: any) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { key: "company" as AppTab, label: "企業様", icon: Building2, count: stats?.company || 0 },
    { key: "liver" as AppTab, label: "ライバー", icon: Mic2, count: stats?.liver || 0 },
    { key: "general" as AppTab, label: "一般参加", icon: Users, count: stats?.general || 0 },
  ];

  const renderTable = () => {
    const loading = activeTab === "company" ? companyLoading : activeTab === "liver" ? liverLoading : generalLoading;
    const data = filterData(activeTab === "company" ? companyList : activeTab === "liver" ? liverList : generalList);

    if (loading) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-400" /></div>;
    if (data.length === 0) return <div className="p-8 text-center text-gray-500">データがありません</div>;

    return (
      <div className="w-full">
        <table className="w-full text-[11px] table-fixed">
          <thead>
            <tr className="border-b border-white/10 text-gray-400">
              {/* 企業様 */}
              {activeTab === "company" && <>
                <th className="text-left p-1.5 w-[12%]">会社名</th>
                <th className="text-left p-1.5 w-[8%]">担当者</th>
                <th className="text-left p-1.5 w-[8%]">部署</th>
                <th className="text-left p-1.5 w-[9%]">電話</th>
                <th className="text-left p-1.5 w-[14%]">メール</th>
                <th className="text-left p-1.5 w-[12%]">TikTok Shop</th>
                <th className="text-left p-1.5 w-[14%]">ブランド紹介</th>
                <th className="text-left p-1.5 w-[8%]">LINE/Lark</th>
                <th className="text-left p-1.5 w-[6%]">ステータス</th>
                <th className="text-left p-1.5 w-[5%]">签到</th>
                <th className="text-left p-1.5 w-[6%]">申込日</th>
                <th className="text-right p-1.5 w-[3%]"></th>
              </>}
              {/* ライバー */}
              {activeTab === "liver" && <>
                <th className="text-left p-1.5 w-[8%]">名前</th>
                <th className="text-left p-1.5 w-[9%]">ライバー名</th>
                <th className="text-left p-1.5 w-[8%]">事務所</th>
                <th className="text-left p-1.5 w-[13%]">メール</th>
                <th className="text-left p-1.5 w-[8%]">電話</th>
                <th className="text-left p-1.5 w-[14%]">アカウント</th>
                <th className="text-left p-1.5 w-[9%]">ジャンル</th>
                <th className="text-left p-1.5 w-[8%]">LINE/Lark</th>
                <th className="text-left p-1.5 w-[5%]">日程</th>
                <th className="text-left p-1.5 w-[5%]">マッチ</th>
                <th className="text-left p-1.5 w-[5%]">ステータス</th>
                <th className="text-left p-1.5 w-[4%]">签到</th>
                <th className="text-left p-1.5 w-[5%]">申込日</th>
                <th className="text-right p-1.5 w-[3%]"></th>
              </>}
              {/* 一般参加 */}
              {activeTab === "general" && <>
                <th className="text-left p-1.5 w-[10%]">名前</th>
                <th className="text-left p-1.5 w-[12%]">会社名</th>
                <th className="text-left p-1.5 w-[10%]">部署</th>
                <th className="text-left p-1.5 w-[16%]">メール</th>
                <th className="text-left p-1.5 w-[10%]">電話</th>
                <th className="text-left p-1.5 w-[7%]">形態</th>
                <th className="text-left p-1.5 w-[7%]">日程</th>
                <th className="text-left p-1.5 w-[14%]">来場目的</th>
                <th className="text-left p-1.5 w-[5%]">ステータス</th>
                <th className="text-left p-1.5 w-[4%]">签到</th>
                <th className="text-left p-1.5 w-[6%]">申込日</th>
                <th className="text-right p-1.5 w-[3%]"></th>
              </>}
            </tr>
          </thead>
          <tbody>
            {data.map((item: any) => (
              <tr key={item.id} className="border-b border-white/5 hover:bg-white/5">
                {/* 企業様 */}
                {activeTab === "company" && <>
                  <td className="p-1.5 font-medium text-white break-all">{item.companyName}</td>
                  <td className="p-1.5 text-gray-400 break-all">{item.contactName || "-"}</td>
                  <td className="p-1.5 text-gray-400 break-all">{item.contactDepartment || "-"}</td>
                  <td className="p-1.5 text-gray-400 break-all">{item.phone || "-"}</td>
                  <td className="p-1.5 text-gray-400 break-all">{item.email}</td>
                  <td className="p-1.5 text-gray-400 break-all">{item.tiktokShopSellerName || "-"}</td>
                  <td className="p-1.5 text-gray-400 break-all line-clamp-2" title={item.brandIntro || ""}>{item.brandIntro || "-"}</td>
                  <td className="p-1.5 text-gray-400 break-all">{item.lineOrLark || "-"}</td>
                </>}
                {/* ライバー */}
                {activeTab === "liver" && <>
                  <td className="p-1.5 font-medium text-white break-all">{item.name}</td>
                  <td className="p-1.5 text-gray-400 break-all">{item.liverName || "-"}</td>
                  <td className="p-1.5 text-gray-400 break-all">{item.agency || "-"}</td>
                  <td className="p-1.5 text-gray-400 break-all">{item.email}</td>
                  <td className="p-1.5 text-gray-400 break-all">{item.phone || "-"}</td>
                  <td className="p-1.5 text-gray-400 break-all line-clamp-2" title={item.accountInfo || ""}>{item.accountInfo || "-"}</td>
                  <td className="p-1.5 text-gray-400 break-all">{item.genre || "-"}</td>
                  <td className="p-1.5 text-gray-400 break-all">{item.lineOrLark || "-"}</td>
                  <td className="p-1.5 text-gray-400">{item.attendanceSchedule === "both_days" ? "両日" : item.attendanceSchedule === "day1_only" ? "8日" : item.attendanceSchedule === "day2_only" ? "9日" : "-"}</td>
                  <td className="p-1.5 text-gray-400">{item.matchingPreference === "yes" ? "○" : "×"}</td>
                </>}
                {/* 一般参加 */}
                {activeTab === "general" && <>
                  <td className="p-1.5 font-medium text-white break-all">{item.name}</td>
                  <td className="p-1.5 text-gray-400 break-all">{item.companyName || "-"}</td>
                  <td className="p-1.5 text-gray-400 break-all">{item.department || "-"}</td>
                  <td className="p-1.5 text-gray-400 break-all">{item.email}</td>
                  <td className="p-1.5 text-gray-400 break-all">{item.phone || "-"}</td>
                  <td className="p-1.5 text-gray-400">{item.participationType === "corporate" ? "法人" : "個人"}</td>
                  <td className="p-1.5 text-gray-400">{item.attendanceSchedule === "both_days" ? "両日" : item.attendanceSchedule === "day1_only" ? "8日" : item.attendanceSchedule === "day2_only" ? "9日" : "-"}</td>
                  <td className="p-1.5 text-gray-400 break-all line-clamp-2">{(item.visitPurposes || []).join(", ") || "-"}</td>
                </>}
                {/* 共通: ステータス・签到・申込日・操作 */}
                <td className="p-1.5">
                  <Badge className={`text-[10px] ${STATUS_CONFIG[item.status as StatusType]?.color || "bg-gray-100"}`}>
                    {STATUS_CONFIG[item.status as StatusType]?.label || item.status}
                  </Badge>
                <td className="p-1.5">{(item as any).ticket?.checkedIn ? <span className="text-green-400 text-xs font-bold">✓ 入場済</span> : (item as any).ticket ? <span className="text-gray-500 text-xs">未入場</span> : <span className="text-gray-600 text-xs">-</span>}</td>
                </td>
                <td className="p-1.5 text-gray-400">{new Date(item.createdAt).toLocaleDateString("ja-JP")}</td>
                <td className="p-1.5 text-right">
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-white" onClick={() => { setStatusDialog({ type: activeTab, id: item.id, currentStatus: item.status }); setNewStatus(item.status); setStatusNotes(""); }}>
                    <Settings className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="grid grid-cols-3 gap-3">
        {tabs.map((tab) => (
          <Card key={tab.key} className={`cursor-pointer transition-all bg-white/5 border-white/10 hover:bg-white/10 ${activeTab === tab.key ? "ring-2 ring-amber-500" : ""}`} onClick={() => setActiveTab(tab.key)}>
            <CardContent className="flex items-center gap-3 p-3">
              <tab.icon className={`h-5 w-5 ${activeTab === tab.key ? "text-amber-400" : "text-gray-400"}`} />
              <div>
                <p className="text-xs text-gray-400">{tab.label}</p>
                <p className="text-xl font-bold text-white">{tab.count}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input placeholder="検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 bg-white/5 border-white/10 text-white placeholder-gray-500" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-white/5 border-white/10 text-white"><SelectValue placeholder="ステータス" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全て</SelectItem>
            <SelectItem value="confirmed">参加確定</SelectItem>
            <SelectItem value="cancelled">キャンセル</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => exportCsv(activeTab)} className="border-white/10 text-gray-300 hover:text-white"><Download className="h-4 w-4 mr-2" />CSV出力</Button>
      </div>

      {/* Table */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-0">{renderTable()}</CardContent>
      </Card>

      {/* Detail Dialog */}
      {detailDialog && (
        <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>申込詳細</DialogTitle></DialogHeader>
            <DetailView type={detailDialog.type} data={detailDialog.data} />
          </DialogContent>
        </Dialog>
      )}

      {/* Status Change Dialog */}
      {statusDialog && (
        <Dialog open={!!statusDialog} onOpenChange={() => setStatusDialog(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>ステータス変更</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as StatusType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">参加確定</SelectItem>
                  <SelectItem value="cancelled">キャンセル</SelectItem>
                </SelectContent>
              </Select>
              <Textarea placeholder="メモ（任意）" value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStatusDialog(null)}>キャンセル</Button>
              <Button onClick={handleStatusUpdate} disabled={updateStatus.isPending} className="bg-amber-500 hover:bg-amber-600 text-black">
                {updateStatus.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}更新
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ===== Detail View =====
function DetailView({ type, data }: { type: AppTab; data: any }) {
  if (type === "company") {
    return (
      <div className="space-y-4">
        <Section title="基本情報">
          <Field label="会社名" value={data.companyName} />
          <Field label="担当者" value={data.contactName} />
          <Field label="部署" value={data.contactDepartment} />
          <Field label="フリガナ" value={data.contactNameKana} />
          <Field label="郵便番号" value={data.postalCode} />
          <Field label="所在地" value={data.address} />
          <Field label="電話番号" value={data.phone} />
          <Field label="メール" value={data.email} />
          <Field label="HP" value={data.websiteUrl} isLink />
          <Field label="LINE/Lark" value={data.lineOrLark} />
        </Section>
        <Section title="TikTok Shop情報">
          <Field label="セラーアカウント名" value={data.tiktokShopSellerName} />
          <Field label="ブランド紹介" value={data.brandIntro} />
          <Field label="TikTok Shop URL" value={data.tiktokShopUrl} isLink />
          <Field label="マッチング希望商品" value={data.matchingProducts} />
          <Field label="ターゲット" value={data.targetAudience} />
          <Field label="販売資格" value={data.salesLicense} />
        </Section>
        <Section title="メタ情報">
          <Field label="ステータス" value={STATUS_CONFIG[data.status as StatusType]?.label} />
          <Field label="メモ" value={data.notes} />
          <Field label="申込日" value={new Date(data.createdAt).toLocaleString("ja-JP")} />
        </Section>
      </div>
    );
  }
  if (type === "liver") {
    return (
      <div className="space-y-4">
        <Section title="基本情報">
          <Field label="名前" value={data.name} />
          <Field label="フリガナ" value={data.nameKana} />
          <Field label="ライバー名" value={data.liverName} />
          <Field label="事務所" value={data.agency} />
          <Field label="アカウント情報" value={data.accountInfo} />
          <Field label="ジャンル" value={data.genre} />
          <Field label="メール" value={data.email} />
          <Field label="電話番号" value={data.phone} />
          <Field label="LINE/Lark" value={data.lineOrLark} />
        </Section>
        <Section title="メタ情報">
          <Field label="ステータス" value={STATUS_CONFIG[data.status as StatusType]?.label} />
          <Field label="メモ" value={data.notes} />
          <Field label="申込日" value={new Date(data.createdAt).toLocaleString("ja-JP")} />
        </Section>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Section title="基本情報">
        <Field label="参加形態" value={data.participationType === "corporate" ? "法人" : "個人"} />
        <Field label="会社名" value={data.companyName} />
        <Field label="名前" value={data.name} />
        <Field label="フリガナ" value={data.nameKana} />
        <Field label="メール" value={data.email} />
        <Field label="電話番号" value={data.phone} />
      </Section>
      <Section title="メタ情報">
        <Field label="ステータス" value={STATUS_CONFIG[data.status as StatusType]?.label} />
        <Field label="メモ" value={data.notes} />
        <Field label="申込日" value={new Date(data.createdAt).toLocaleString("ja-JP")} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold text-sm text-gray-500 mb-2 border-b pb-1">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function Field({ label, value, isLink }: { label: string; value?: string | null; isLink?: boolean }) {
  if (!value) return null;
  return (
    <div className="text-sm">
      <span className="text-gray-500">{label}: </span>
      {isLink ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline break-all">{value}</a>
      ) : (
        <span className="font-medium break-all">{value}</span>
      )}
    </div>
  );
}

// ===== Event Settings =====
function EventPanel() {
  const { data: settings } = trpc.festival.getEventSettings.useQuery({ eventYear: "2026" });
  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader><CardTitle className="text-white">イベント設定</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {settings ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <Field label="イベント名" value={settings.eventName} />
            <Field label="会場" value={settings.venue} />
            <Field label="住所" value={settings.venueAddress} />
            <Field label="Day1" value={settings.day1Date} />
            <Field label="Day2" value={settings.day2Date} />
            <Field label="定員" value={settings.maxCapacity?.toString()} />
          </div>
        ) : (
          <p className="text-gray-400">イベント設定がまだありません</p>
        )}
      </CardContent>
    </Card>
  );
}

// ===== Sponsors =====
function SponsorsPanel() {
  const { data: sponsors } = trpc.festival.listSponsors.useQuery({ eventYear: "2026" });
  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader><CardTitle className="text-white">スポンサー一覧</CardTitle></CardHeader>
      <CardContent>
        {sponsors && sponsors.length > 0 ? (
          <div className="space-y-3">
            {sponsors.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div>
                  <p className="font-medium text-white">{s.companyName}</p>
                  <p className="text-xs text-gray-400">{s.tier} • {s.contactEmail}</p>
                </div>
                <Badge className={s.status === "confirmed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                  {s.status === "confirmed" ? "確定" : "保留"}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">スポンサーがまだ登録されていません</p>
        )}
      </CardContent>
    </Card>
  );
}

// ===== Accounts Management =====
function AccountsPanel() {
  const { data: accounts } = trpc.festivalAuth.listAccounts.useQuery({});
  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [resetResult, setResetResult] = useState<{email: string; newPassword: string} | null>(null);
  const utils = trpc.useUtils();

  const createAdmin = trpc.festivalAuth.createAdmin.useMutation({
    onSuccess: () => {
      utils.festivalAuth.listAccounts.invalidate();
      setShowCreate(false);
      setEmail(""); setPassword(""); setDisplayName("");
    },
  });

  const resetPassword = trpc.festivalAuth.resetPassword.useMutation({
    onSuccess: (data) => {
      setResetResult({ email: data.email, newPassword: data.newPassword });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-white">アカウント管理</h2>
        <Button onClick={() => setShowCreate(true)} className="bg-amber-500 hover:bg-amber-600 text-black">
          <UserPlus className="w-4 h-4 mr-2" />管理者追加
        </Button>
      </div>

      {/* パスワードリセット結果表示 */}
      {resetResult && (
        <Card className="bg-green-900/30 border-green-500/30">
          <CardContent className="p-4">
            <p className="text-green-300 font-medium mb-2">パスワードをリセットしました</p>
            <p className="text-sm text-gray-300">メール: <span className="text-white font-mono">{resetResult.email}</span></p>
            <p className="text-sm text-gray-300">新パスワード: <span className="text-white font-mono bg-white/10 px-2 py-0.5 rounded">{resetResult.newPassword}</span></p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setResetResult(null)}>閉じる</Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-400">
                <th className="text-left p-3">ID</th>
                <th className="text-left p-3">名前</th>
                <th className="text-left p-3">メール(ログインID)</th>
                <th className="text-left p-3">タイプ</th>
                <th className="text-left p-3">登録日</th>
                <th className="text-left p-3">最終ログイン</th>
                <th className="text-left p-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {accounts?.map((acc: any) => (
                <tr key={acc.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 text-gray-500 font-mono text-xs">#{acc.id}</td>
                  <td className="p-3 text-white font-medium">{acc.displayName}</td>
                  <td className="p-3 text-gray-300 font-mono text-xs">{acc.email}</td>
                  <td className="p-3">
                    <Badge className={acc.accountType === "admin" ? "bg-amber-100 text-amber-800" : acc.accountType === "company" ? "bg-blue-100 text-blue-800" : acc.accountType === "liver" ? "bg-pink-100 text-pink-800" : "bg-green-100 text-green-800"}>
                      {acc.accountType}
                    </Badge>
                  </td>
                  <td className="p-3 text-gray-400 text-xs">{new Date(acc.createdAt).toLocaleDateString("ja-JP")}</td>
                  <td className="p-3 text-gray-400 text-xs">{acc.lastLoginAt ? new Date(acc.lastLoginAt).toLocaleString("ja-JP") : "未ログイン"}</td>
                  <td className="p-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => resetPassword.mutate({ accountId: acc.id })}
                      disabled={resetPassword.isPending}
                    >
                      {resetPassword.isPending ? "..." : "PWリセット"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Create Admin Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>管理者アカウント作成</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">名前</label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="管理者名" />
            </div>
            <div>
              <label className="text-sm font-medium">メールアドレス</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" type="email" />
            </div>
            <div>
              <label className="text-sm font-medium">パスワード</label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6文字以上" type="password" />
            </div>
            {createAdmin.error && (
              <p className="text-sm text-red-500">{createAdmin.error.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>キャンセル</Button>
            <Button onClick={() => createAdmin.mutate({ email, password, displayName })} disabled={createAdmin.isPending || !email || !password || !displayName} className="bg-amber-500 hover:bg-amber-600 text-black">
              {createAdmin.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Activity Log =====
function ActivityLogPanel() {
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState("all");
  const limit = 30;

  const { data, isLoading } = trpc.festival.listActivityLogs.useQuery({
    limit,
    offset: page * limit,
    action: actionFilter !== "all" ? actionFilter : undefined,
  });

  const actionLabels: Record<string, string> = {
    login: "ログイン",
    submit_application: "申込送信",
    password_reset: "PWリセット",
    view_dashboard: "ダッシュボード閲覧",
    update_profile: "プロフィール更新",
  };

  const actionColors: Record<string, string> = {
    login: "bg-blue-100 text-blue-800",
    submit_application: "bg-green-100 text-green-800",
    password_reset: "bg-amber-100 text-amber-800",
    view_dashboard: "bg-gray-100 text-gray-800",
    update_profile: "bg-purple-100 text-purple-800",
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-white">操作履歴（アクティビティログ）</h2>
        <div className="flex items-center gap-2">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[160px] bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="全て" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全て</SelectItem>
              <SelectItem value="login">ログイン</SelectItem>
              <SelectItem value="submit_application">申込送信</SelectItem>
              <SelectItem value="password_reset">PWリセット</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-400" /></div>
          ) : !data?.logs?.length ? (
            <div className="p-8 text-center text-gray-500">操作履歴がありません</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400">
                  <th className="text-left p-3">日時</th>
                  <th className="text-left p-3">アカウント</th>
                  <th className="text-left p-3">タイプ</th>
                  <th className="text-left p-3">操作</th>
                  <th className="text-left p-3">詳細</th>
                  <th className="text-left p-3">IP</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((log: any) => (
                  <tr key={log.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("ja-JP")}
                    </td>
                    <td className="p-3 text-white text-xs font-mono">{log.accountEmail}</td>
                    <td className="p-3">
                      <Badge className={log.accountType === "admin" ? "bg-amber-100 text-amber-800" : log.accountType === "company" ? "bg-blue-100 text-blue-800" : log.accountType === "liver" ? "bg-pink-100 text-pink-800" : "bg-green-100 text-green-800"}>
                        {log.accountType}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge className={actionColors[log.action] || "bg-gray-100 text-gray-800"}>
                        {actionLabels[log.action] || log.action}
                      </Badge>
                    </td>
                    <td className="p-3 text-gray-400 text-xs max-w-[200px] truncate">
                      {log.details ? (() => { try { const d = JSON.parse(log.details); return Object.values(d).join(', '); } catch { return log.details; } })() : "-"}
                    </td>
                    <td className="p-3 text-gray-500 text-xs font-mono">{log.ipAddress || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.total > limit && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-400">全{data.total}件中 {page * limit + 1}〜{Math.min((page + 1) * limit, data.total)}件</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>前へ</Button>
            <Button variant="outline" size="sm" disabled={(page + 1) * limit >= data.total} onClick={() => setPage(p => p + 1)}>次へ</Button>
          </div>
        </div>
      )}
    </div>
  );
}
