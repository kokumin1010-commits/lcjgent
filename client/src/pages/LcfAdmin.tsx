/**
 * LCF Admin - Live Commerce Festival 専用管理画面
 * /lcf/admin でアクセス可能
 * lcf_token (role=admin) で認証
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import {
  LayoutDashboard, Users, Building2, Mic2, Calendar, Trophy,
  Search, Download, Eye, CheckCircle, XCircle, Clock, Loader2,
  LogOut, Settings, MessageCircle, UserPlus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

type MainTab = "dashboard" | "applications" | "event" | "sponsors" | "accounts";
type AppTab = "company" | "liver" | "general";
type StatusType = "new" | "confirmed" | "rejected" | "cancelled";

const STATUS_CONFIG: Record<StatusType, { label: string; color: string; icon: any }> = {
  new: { label: "新規", color: "bg-blue-100 text-blue-800", icon: Clock },
  confirmed: { label: "確認済み", color: "bg-green-100 text-green-800", icon: CheckCircle },
  rejected: { label: "却下", color: "bg-red-100 text-red-800", icon: XCircle },
  cancelled: { label: "キャンセル", color: "bg-gray-100 text-gray-800", icon: XCircle },
};

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
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
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
      <div className="max-w-7xl mx-auto px-4 py-4">
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
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {mainTab === "dashboard" && <DashboardPanel />}
        {mainTab === "applications" && <ApplicationsPanel />}
        {mainTab === "event" && <EventPanel />}
        {mainTab === "sponsors" && <SponsorsPanel />}
        {mainTab === "accounts" && <AccountsPanel />}
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
  const [newStatus, setNewStatus] = useState<StatusType>("new");
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
      headers = ["ID", "会社名", "担当者", "メール", "電話", "ステータス", "申込日"];
      filename = "lcf_company_applications.csv";
      data = data.map(d => [d.id, d.companyName, d.contactName, d.email, d.phone, STATUS_CONFIG[d.status as StatusType]?.label, new Date(d.createdAt).toLocaleDateString("ja-JP")]);
    } else if (type === "liver") {
      data = liverList || [];
      headers = ["ID", "名前", "ライバー名", "メール", "電話", "ステータス", "申込日"];
      filename = "lcf_liver_applications.csv";
      data = data.map(d => [d.id, d.name, d.liverName, d.email, d.phone, STATUS_CONFIG[d.status as StatusType]?.label, new Date(d.createdAt).toLocaleDateString("ja-JP")]);
    } else {
      data = generalList || [];
      headers = ["ID", "名前", "会社名", "メール", "電話", "ステータス", "申込日"];
      filename = "lcf_general_applications.csv";
      data = data.map(d => [d.id, d.name, d.companyName, d.email, d.phone, STATUS_CONFIG[d.status as StatusType]?.label, new Date(d.createdAt).toLocaleDateString("ja-JP")]);
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
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-gray-400">
              <th className="text-left p-3">名前</th>
              <th className="text-left p-3">メール</th>
              <th className="text-left p-3">ステータス</th>
              <th className="text-left p-3">申込日</th>
              <th className="text-right p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item: any) => (
              <tr key={item.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-3 font-medium text-white">
                  {activeTab === "company" ? item.companyName : item.name || item.liverName}
                </td>
                <td className="p-3 text-gray-400">{item.email}</td>
                <td className="p-3">
                  <Badge className={STATUS_CONFIG[item.status as StatusType]?.color || "bg-gray-100"}>
                    {STATUS_CONFIG[item.status as StatusType]?.label || item.status}
                  </Badge>
                </td>
                <td className="p-3 text-gray-400">{new Date(item.createdAt).toLocaleDateString("ja-JP")}</td>
                <td className="p-3 text-right space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => setDetailDialog({ type: activeTab, data: item })} className="text-gray-400 hover:text-white">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setStatusDialog({ type: activeTab, id: item.id, currentStatus: item.status }); setNewStatus(item.status); setStatusNotes(""); }} className="text-gray-400 hover:text-white">
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
            <SelectItem value="new">新規</SelectItem>
            <SelectItem value="confirmed">確認済み</SelectItem>
            <SelectItem value="rejected">却下</SelectItem>
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
                  <SelectItem value="new">新規</SelectItem>
                  <SelectItem value="confirmed">確認済み</SelectItem>
                  <SelectItem value="rejected">却下</SelectItem>
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
  const utils = trpc.useUtils();

  const createAdmin = trpc.festivalAuth.createAdmin.useMutation({
    onSuccess: () => {
      utils.festivalAuth.listAccounts.invalidate();
      setShowCreate(false);
      setEmail(""); setPassword(""); setDisplayName("");
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

      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-400">
                <th className="text-left p-3">名前</th>
                <th className="text-left p-3">メール</th>
                <th className="text-left p-3">タイプ</th>
                <th className="text-left p-3">最終ログイン</th>
              </tr>
            </thead>
            <tbody>
              {accounts?.map((acc: any) => (
                <tr key={acc.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 text-white font-medium">{acc.displayName}</td>
                  <td className="p-3 text-gray-400">{acc.email}</td>
                  <td className="p-3">
                    <Badge className={acc.accountType === "admin" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}>
                      {acc.accountType}
                    </Badge>
                  </td>
                  <td className="p-3 text-gray-400">{acc.lastLoginAt ? new Date(acc.lastLoginAt).toLocaleDateString("ja-JP") : "-"}</td>
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
