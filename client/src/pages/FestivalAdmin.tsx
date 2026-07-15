/**
 * LCF イベント管理ダッシュボード
 * - ダッシュボード（統計サマリー）
 * - 申込管理（企業・ライバー・一般）
 * - イベント設定（日程・会場・プログラム）
 * - スポンサー管理
 * - LINE連携データ
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Building2, Mic2, Users, Download, Search, ExternalLink, PartyPopper, Settings, Trophy, MessageCircle, LayoutDashboard, Plus, Trash2, Save, Calendar } from "lucide-react";
import { toast } from "sonner";

type MainTabType = "dashboard" | "applications" | "event" | "sponsors" | "line";
type AppTabType = "company" | "liver" | "general";
type StatusType = "new" | "confirmed" | "rejected" | "cancelled";

const STATUS_CONFIG: Record<StatusType, { label: string; color: string }> = {
  new: { label: "新規", color: "bg-blue-500" },
  confirmed: { label: "確認済み", color: "bg-green-500" },
  rejected: { label: "却下", color: "bg-red-500" },
  cancelled: { label: "キャンセル", color: "bg-gray-500" },
};

const ATTENDANCE_LABELS: Record<string, string> = {
  day1_only: "Day1のみ",
  day2_only: "Day2のみ",
  both_days: "両日",
};

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  platinum: { label: "プラチナ", color: "bg-purple-500" },
  gold: { label: "ゴールド", color: "bg-yellow-500" },
  silver: { label: "シルバー", color: "bg-gray-400" },
  bronze: { label: "ブロンズ", color: "bg-amber-700" },
  partner: { label: "パートナー", color: "bg-blue-500" },
};

export default function FestivalAdmin() {
  const [mainTab, setMainTab] = useState<MainTabType>("dashboard");

  const mainTabs = [
    { key: "dashboard" as MainTabType, label: "ダッシュボード", icon: LayoutDashboard },
    { key: "applications" as MainTabType, label: "申込管理", icon: Users },
    { key: "event" as MainTabType, label: "イベント設定", icon: Calendar },
    { key: "sponsors" as MainTabType, label: "スポンサー", icon: Trophy },
    { key: "line" as MainTabType, label: "LINE連携", icon: MessageCircle },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <PartyPopper className="h-7 w-7 text-amber-500" />
          <div>
            <h1 className="text-2xl font-bold">LCF イベント管理</h1>
            <p className="text-sm text-muted-foreground">Live Commerce Festival 2026</p>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b pb-3">
        {mainTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMainTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mainTab === tab.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {mainTab === "dashboard" && <DashboardPanel />}
      {mainTab === "applications" && <ApplicationsPanel />}
      {mainTab === "event" && <EventSettingsPanel />}
      {mainTab === "sponsors" && <SponsorsPanel />}
      {mainTab === "line" && <LinePanel />}
    </div>
  );
}

// ===== Dashboard Panel =====
function DashboardPanel() {
  const { data: stats } = trpc.festival.stats.useQuery({ eventYear: "2026" });
  const { data: lineCount } = trpc.festival.lineRegistrationCount.useQuery({ eventYear: "2026" });
  const { data: sponsors } = trpc.festival.listSponsors.useQuery({ eventYear: "2026" });

  const confirmedSponsors = sponsors?.filter(s => s.status === "confirmed").length || 0;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">企業申込</p>
            <p className="text-3xl font-bold text-blue-600">{stats?.company || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">ライバー申込</p>
            <p className="text-3xl font-bold text-pink-600">{stats?.liver || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">一般参加</p>
            <p className="text-3xl font-bold text-green-600">{stats?.general || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">LINE登録</p>
            <p className="text-3xl font-bold text-emerald-600">{lineCount?.count || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">スポンサー</p>
            <p className="text-3xl font-bold text-purple-600">{confirmedSponsors}</p>
          </CardContent>
        </Card>
      </div>

      {/* Total */}
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-amber-700 font-medium">総申込数</p>
            <p className="text-4xl font-bold text-amber-900">{stats?.total || 0} <span className="text-lg">件</span></p>
          </div>
          <PartyPopper className="h-12 w-12 text-amber-400" />
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Applications Panel =====
function ApplicationsPanel() {
  const [activeTab, setActiveTab] = useState<AppTabType>("company");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [detailDialog, setDetailDialog] = useState<{ type: AppTabType; data: any } | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ type: AppTabType; id: number; currentStatus: StatusType } | null>(null);
  const [newStatus, setNewStatus] = useState<StatusType>("new");
  const [statusNotes, setStatusNotes] = useState("");

  const { data: stats } = trpc.festival.stats.useQuery({ eventYear: "2026" });
  const { data: companyList, isLoading: companyLoading, refetch: refetchCompany } = trpc.festival.listCompany.useQuery({ eventYear: "2026" });
  const { data: liverList, isLoading: liverLoading, refetch: refetchLiver } = trpc.festival.listLiver.useQuery({ eventYear: "2026" });
  const { data: generalList, isLoading: generalLoading, refetch: refetchGeneral } = trpc.festival.listGeneral.useQuery({ eventYear: "2026" });

  const updateStatus = trpc.festival.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("ステータスを更新しました");
      refetchCompany(); refetchLiver(); refetchGeneral();
      setStatusDialog(null);
    },
    onError: (err) => toast.error(`更新失敗: ${err.message}`),
  });

  const handleStatusUpdate = () => {
    if (!statusDialog) return;
    updateStatus.mutate({ type: statusDialog.type, id: statusDialog.id, status: newStatus, notes: statusNotes || undefined });
  };

  const filterData = (data: any[] | undefined) => {
    if (!data) return [];
    return data.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesSearch = searchTerm === "" || JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  };

  const exportCsv = (type: AppTabType) => {
    let data: any[] = [];
    let headers: string[] = [];
    let filename = "";
    if (type === "company") {
      data = companyList || [];
      headers = ["ID", "会社名", "担当者", "部署", "メール", "電話", "TikTok Shop", "ステータス", "申込日"];
      filename = "festival_company_applications.csv";
      data = data.map(d => [d.id, d.companyName, d.contactName, d.contactDepartment, d.email, d.phone, d.tiktokShopSellerName, STATUS_CONFIG[d.status as StatusType]?.label, new Date(d.createdAt).toLocaleDateString("ja-JP")]);
    } else if (type === "liver") {
      data = liverList || [];
      headers = ["ID", "名前", "ライバー名", "事務所", "メール", "電話", "参加日程", "マッチング", "ステータス", "申込日"];
      filename = "festival_liver_applications.csv";
      data = data.map(d => [d.id, d.name, d.liverName, d.agency || "-", d.email, d.phone, ATTENDANCE_LABELS[d.attendanceSchedule], d.matchingPreference === "yes" ? "希望する" : "希望しない", STATUS_CONFIG[d.status as StatusType]?.label, new Date(d.createdAt).toLocaleDateString("ja-JP")]);
    } else {
      data = generalList || [];
      headers = ["ID", "名前", "会社名", "メール", "電話", "参加形態", "参加日程", "来場目的", "ステータス", "申込日"];
      filename = "festival_general_applications.csv";
      data = data.map(d => [d.id, d.name, d.companyName, d.email, d.phone, d.participationType === "corporate" ? "法人" : "個人", ATTENDANCE_LABELS[d.attendanceSchedule], (d.visitPurposes || []).join("/"), STATUS_CONFIG[d.status as StatusType]?.label, new Date(d.createdAt).toLocaleDateString("ja-JP")]);
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
    { key: "company" as AppTabType, label: "企業様", icon: Building2, count: stats?.company || 0 },
    { key: "liver" as AppTabType, label: "ライバー", icon: Mic2, count: stats?.liver || 0 },
    { key: "general" as AppTabType, label: "一般参加", icon: Users, count: stats?.general || 0 },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="grid grid-cols-3 gap-3">
        {tabs.map((tab) => (
          <Card key={tab.key} className={`cursor-pointer transition-all hover:shadow-md ${activeTab === tab.key ? "ring-2 ring-primary" : ""}`} onClick={() => setActiveTab(tab.key)}>
            <CardContent className="flex items-center gap-3 p-3">
              <tab.icon className={`h-5 w-5 ${activeTab === tab.key ? "text-primary" : "text-muted-foreground"}`} />
              <div>
                <p className="text-xs text-muted-foreground">{tab.label}</p>
                <p className="text-xl font-bold">{tab.count}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="ステータス" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全て</SelectItem>
            <SelectItem value="new">新規</SelectItem>
            <SelectItem value="confirmed">確認済み</SelectItem>
            <SelectItem value="rejected">却下</SelectItem>
            <SelectItem value="cancelled">キャンセル</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => exportCsv(activeTab)}><Download className="h-4 w-4 mr-2" />CSV出力</Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {activeTab === "company" && <CompanyTable data={filterData(companyList)} loading={companyLoading} onDetail={(d) => setDetailDialog({ type: "company", data: d })} onStatusChange={(id, status) => { setStatusDialog({ type: "company", id, currentStatus: status }); setNewStatus(status); setStatusNotes(""); }} />}
          {activeTab === "liver" && <LiverTable data={filterData(liverList)} loading={liverLoading} onDetail={(d) => setDetailDialog({ type: "liver", data: d })} onStatusChange={(id, status) => { setStatusDialog({ type: "liver", id, currentStatus: status }); setNewStatus(status); setStatusNotes(""); }} />}
          {activeTab === "general" && <GeneralTable data={filterData(generalList)} loading={generalLoading} onDetail={(d) => setDetailDialog({ type: "general", data: d })} onStatusChange={(id, status) => { setStatusDialog({ type: "general", id, currentStatus: status }); setNewStatus(status); setStatusNotes(""); }} />}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      {detailDialog && (
        <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{detailDialog.type === "company" ? "企業申込み詳細" : detailDialog.type === "liver" ? "ライバー申込み詳細" : "一般参加申込み詳細"}</DialogTitle></DialogHeader>
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
              <Button onClick={handleStatusUpdate} disabled={updateStatus.isPending}>
                {updateStatus.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}更新
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ===== Event Settings Panel =====
function EventSettingsPanel() {
  const { data: settings, isLoading, refetch } = trpc.festival.getEventSettings.useQuery({ eventYear: "2026" });
  const updateMutation = trpc.festival.updateEventSettings.useMutation({
    onSuccess: () => { toast.success("イベント設定を保存しました"); refetch(); },
    onError: (err) => toast.error(`保存失敗: ${err.message}`),
  });

  const [form, setForm] = useState({
    eventName: "", venue: "", venueAddress: "", day1Date: "", day2Date: "",
    day1StartTime: "", day1EndTime: "", day2StartTime: "", day2EndTime: "",
    maxCapacity: 0, description: "",
  });
  const [programs, setPrograms] = useState<{ time: string; title: string; speaker?: string; description?: string }[]>([]);
  const [initialized, setInitialized] = useState(false);

  if (settings && !initialized) {
    setForm({
      eventName: settings.eventName || "",
      venue: settings.venue || "",
      venueAddress: settings.venueAddress || "",
      day1Date: settings.day1Date || "",
      day2Date: settings.day2Date || "",
      day1StartTime: settings.day1StartTime || "",
      day1EndTime: settings.day1EndTime || "",
      day2StartTime: settings.day2StartTime || "",
      day2EndTime: settings.day2EndTime || "",
      maxCapacity: settings.maxCapacity || 0,
      description: settings.description || "",
    });
    setPrograms(settings.programs || []);
    setInitialized(true);
  }

  const handleSave = () => {
    updateMutation.mutate({
      ...form,
      maxCapacity: form.maxCapacity || undefined,
      programs,
    });
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> 基本設定</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">イベント名</label>
              <Input value={form.eventName} onChange={e => setForm(p => ({ ...p, eventName: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">定員</label>
              <Input type="number" value={form.maxCapacity} onChange={e => setForm(p => ({ ...p, maxCapacity: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="text-sm font-medium">会場名</label>
              <Input value={form.venue} onChange={e => setForm(p => ({ ...p, venue: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">会場住所</label>
              <Input value={form.venueAddress} onChange={e => setForm(p => ({ ...p, venueAddress: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Day1 日付</label>
              <Input value={form.day1Date} onChange={e => setForm(p => ({ ...p, day1Date: e.target.value }))} placeholder="2026/9/8" />
            </div>
            <div>
              <label className="text-sm font-medium">Day1 時間</label>
              <Input value={form.day1StartTime} onChange={e => setForm(p => ({ ...p, day1StartTime: e.target.value }))} placeholder="10:00" />
            </div>
            <div>
              <label className="text-sm font-medium">Day2 日付</label>
              <Input value={form.day2Date} onChange={e => setForm(p => ({ ...p, day2Date: e.target.value }))} placeholder="2026/9/9" />
            </div>
            <div>
              <label className="text-sm font-medium">Day2 時間</label>
              <Input value={form.day2StartTime} onChange={e => setForm(p => ({ ...p, day2StartTime: e.target.value }))} placeholder="10:00" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">説明</label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} />
          </div>
        </CardContent>
      </Card>

      {/* Programs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> プログラム</CardTitle>
            <Button size="sm" onClick={() => setPrograms(p => [...p, { time: "", title: "" }])}><Plus className="h-4 w-4 mr-1" />追加</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {programs.map((prog, i) => (
            <div key={i} className="flex gap-2 items-start">
              <Input className="w-24" placeholder="10:00" value={prog.time} onChange={e => { const p = [...programs]; p[i] = { ...p[i], time: e.target.value }; setPrograms(p); }} />
              <Input className="flex-1" placeholder="プログラムタイトル" value={prog.title} onChange={e => { const p = [...programs]; p[i] = { ...p[i], title: e.target.value }; setPrograms(p); }} />
              <Input className="w-32" placeholder="登壇者" value={prog.speaker || ""} onChange={e => { const p = [...programs]; p[i] = { ...p[i], speaker: e.target.value }; setPrograms(p); }} />
              <Button variant="ghost" size="sm" onClick={() => setPrograms(p => p.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4 text-red-500" /></Button>
            </div>
          ))}
          {programs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">プログラムがありません</p>}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full md:w-auto">
        {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        設定を保存
      </Button>
    </div>
  );
}

// ===== Sponsors Panel =====
function SponsorsPanel() {
  const { data: sponsors, isLoading, refetch } = trpc.festival.listSponsors.useQuery({ eventYear: "2026" });
  const addMutation = trpc.festival.addSponsor.useMutation({ onSuccess: () => { toast.success("スポンサーを追加しました"); refetch(); setAddDialog(false); } });
  const updateMutation = trpc.festival.updateSponsor.useMutation({ onSuccess: () => { toast.success("更新しました"); refetch(); } });
  const deleteMutation = trpc.festival.deleteSponsor.useMutation({ onSuccess: () => { toast.success("削除しました"); refetch(); } });

  const [addDialog, setAddDialog] = useState(false);
  const [newSponsor, setNewSponsor] = useState({ companyName: "", tier: "bronze" as string, contactName: "", contactEmail: "", websiteUrl: "", sponsorshipAmount: 0, boothSize: "" });

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{sponsors?.length || 0} 社</p>
        <Button onClick={() => setAddDialog(true)}><Plus className="h-4 w-4 mr-2" />スポンサー追加</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>企業名</TableHead>
                  <TableHead>ティア</TableHead>
                  <TableHead>担当者</TableHead>
                  <TableHead>メール</TableHead>
                  <TableHead>金額</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sponsors || []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.companyName}</TableCell>
                    <TableCell><Badge className={`${TIER_CONFIG[s.tier]?.color} text-white`}>{TIER_CONFIG[s.tier]?.label}</Badge></TableCell>
                    <TableCell className="text-sm">{s.contactName || "-"}</TableCell>
                    <TableCell className="text-xs">{s.contactEmail || "-"}</TableCell>
                    <TableCell className="text-sm">{s.sponsorshipAmount ? `¥${s.sponsorshipAmount.toLocaleString()}` : "-"}</TableCell>
                    <TableCell>
                      <Select value={s.status} onValueChange={(v) => updateMutation.mutate({ id: s.id, status: v as any })}>
                        <SelectTrigger className="w-[100px] h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">保留</SelectItem>
                          <SelectItem value="confirmed">確定</SelectItem>
                          <SelectItem value="cancelled">キャンセル</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm("削除しますか？")) deleteMutation.mutate({ id: s.id }); }}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!sponsors || sponsors.length === 0) && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">スポンサーがありません</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>スポンサー追加</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="企業名 *" value={newSponsor.companyName} onChange={e => setNewSponsor(p => ({ ...p, companyName: e.target.value }))} />
            <Select value={newSponsor.tier} onValueChange={v => setNewSponsor(p => ({ ...p, tier: v }))}>
              <SelectTrigger><SelectValue placeholder="ティア" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="platinum">プラチナ</SelectItem>
                <SelectItem value="gold">ゴールド</SelectItem>
                <SelectItem value="silver">シルバー</SelectItem>
                <SelectItem value="bronze">ブロンズ</SelectItem>
                <SelectItem value="partner">パートナー</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="担当者名" value={newSponsor.contactName} onChange={e => setNewSponsor(p => ({ ...p, contactName: e.target.value }))} />
            <Input placeholder="メール" value={newSponsor.contactEmail} onChange={e => setNewSponsor(p => ({ ...p, contactEmail: e.target.value }))} />
            <Input placeholder="Webサイト" value={newSponsor.websiteUrl} onChange={e => setNewSponsor(p => ({ ...p, websiteUrl: e.target.value }))} />
            <Input type="number" placeholder="協賛金額" value={newSponsor.sponsorshipAmount || ""} onChange={e => setNewSponsor(p => ({ ...p, sponsorshipAmount: parseInt(e.target.value) || 0 }))} />
            <Input placeholder="ブースサイズ" value={newSponsor.boothSize} onChange={e => setNewSponsor(p => ({ ...p, boothSize: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>キャンセル</Button>
            <Button onClick={() => addMutation.mutate({ companyName: newSponsor.companyName, tier: newSponsor.tier as any, contactName: newSponsor.contactName || undefined, contactEmail: newSponsor.contactEmail || undefined, websiteUrl: newSponsor.websiteUrl || undefined, sponsorshipAmount: newSponsor.sponsorshipAmount || undefined, boothSize: newSponsor.boothSize || undefined })} disabled={!newSponsor.companyName || addMutation.isPending}>
              {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== LINE Panel =====
function LinePanel() {
  const { data: registrations, isLoading } = trpc.festival.listLineRegistrations.useQuery({ eventYear: "2026" });
  const { data: lineCount } = trpc.festival.lineRegistrationCount.useQuery({ eventYear: "2026" });

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <CardContent className="p-4 flex items-center gap-4">
          <MessageCircle className="h-8 w-8 text-green-600" />
          <div>
            <p className="text-sm text-green-700">LINE登録者数</p>
            <p className="text-3xl font-bold text-green-900">{lineCount?.count || 0} <span className="text-sm font-normal">人</span></p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>表示名</TableHead>
                  <TableHead>LINE User ID</TableHead>
                  <TableHead>登録元</TableHead>
                  <TableHead>登録日</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(registrations || []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.id}</TableCell>
                    <TableCell>{r.displayName || "-"}</TableCell>
                    <TableCell className="text-xs font-mono">{r.lineUserId || "-"}</TableCell>
                    <TableCell className="text-xs">{r.registeredFrom || "-"}</TableCell>
                    <TableCell className="text-xs">{new Date(r.createdAt).toLocaleDateString("ja-JP")}</TableCell>
                  </TableRow>
                ))}
                {(!registrations || registrations.length === 0) && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">LINE登録データがありません</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Shared Components =====

function CompanyTable({ data, loading, onDetail, onStatusChange }: { data: any[]; loading: boolean; onDetail: (d: any) => void; onStatusChange: (id: number, status: StatusType) => void }) {
  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (data.length === 0) return <div className="text-center p-8 text-muted-foreground">データがありません</div>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">ID</TableHead>
            <TableHead>会社名</TableHead>
            <TableHead>担当者</TableHead>
            <TableHead>メール</TableHead>
            <TableHead>TikTok Shop</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead>申込日</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onDetail(item)}>
              <TableCell className="font-mono text-xs">{item.id}</TableCell>
              <TableCell className="font-medium max-w-[180px] truncate">{item.companyName}</TableCell>
              <TableCell>{item.contactName}</TableCell>
              <TableCell className="text-xs">{item.email}</TableCell>
              <TableCell className="text-xs max-w-[100px] truncate">{item.tiktokShopSellerName}</TableCell>
              <TableCell><StatusBadge status={item.status} onClick={(e) => { e.stopPropagation(); onStatusChange(item.id, item.status); }} /></TableCell>
              <TableCell className="text-xs">{new Date(item.createdAt).toLocaleDateString("ja-JP")}</TableCell>
              <TableCell><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDetail(item); }}><ExternalLink className="h-4 w-4" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LiverTable({ data, loading, onDetail, onStatusChange }: { data: any[]; loading: boolean; onDetail: (d: any) => void; onStatusChange: (id: number, status: StatusType) => void }) {
  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (data.length === 0) return <div className="text-center p-8 text-muted-foreground">データがありません</div>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">ID</TableHead>
            <TableHead>名前</TableHead>
            <TableHead>ライバー名</TableHead>
            <TableHead>事務所</TableHead>
            <TableHead>メール</TableHead>
            <TableHead>参加日程</TableHead>
            <TableHead>マッチング</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead>申込日</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onDetail(item)}>
              <TableCell className="font-mono text-xs">{item.id}</TableCell>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell>{item.liverName}</TableCell>
              <TableCell className="text-xs">{item.agency || "-"}</TableCell>
              <TableCell className="text-xs">{item.email}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{ATTENDANCE_LABELS[item.attendanceSchedule]}</Badge></TableCell>
              <TableCell className="text-xs">{item.matchingPreference === "yes" ? "希望する" : "希望しない"}</TableCell>
              <TableCell><StatusBadge status={item.status} onClick={(e) => { e.stopPropagation(); onStatusChange(item.id, item.status); }} /></TableCell>
              <TableCell className="text-xs">{new Date(item.createdAt).toLocaleDateString("ja-JP")}</TableCell>
              <TableCell><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDetail(item); }}><ExternalLink className="h-4 w-4" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function GeneralTable({ data, loading, onDetail, onStatusChange }: { data: any[]; loading: boolean; onDetail: (d: any) => void; onStatusChange: (id: number, status: StatusType) => void }) {
  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (data.length === 0) return <div className="text-center p-8 text-muted-foreground">データがありません</div>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">ID</TableHead>
            <TableHead>名前</TableHead>
            <TableHead>会社名</TableHead>
            <TableHead>メール</TableHead>
            <TableHead>参加形態</TableHead>
            <TableHead>参加日程</TableHead>
            <TableHead>来場目的</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead>申込日</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onDetail(item)}>
              <TableCell className="font-mono text-xs">{item.id}</TableCell>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell className="text-xs">{item.companyName}</TableCell>
              <TableCell className="text-xs">{item.email}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{item.participationType === "corporate" ? "法人" : "個人"}</Badge></TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{ATTENDANCE_LABELS[item.attendanceSchedule]}</Badge></TableCell>
              <TableCell className="text-xs max-w-[120px] truncate">{(item.visitPurposes || []).join(", ")}</TableCell>
              <TableCell><StatusBadge status={item.status} onClick={(e) => { e.stopPropagation(); onStatusChange(item.id, item.status); }} /></TableCell>
              <TableCell className="text-xs">{new Date(item.createdAt).toLocaleDateString("ja-JP")}</TableCell>
              <TableCell><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDetail(item); }}><ExternalLink className="h-4 w-4" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StatusBadge({ status, onClick }: { status: string; onClick: (e: React.MouseEvent) => void }) {
  const config = STATUS_CONFIG[status as StatusType] || STATUS_CONFIG.new;
  return <Badge className={`${config.color} text-white cursor-pointer hover:opacity-80`} onClick={onClick}>{config.label}</Badge>;
}

function DetailView({ type, data }: { type: AppTabType; data: any }) {
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
        <Section title="参加情報">
          <Field label="参加日程" value={ATTENDANCE_LABELS[data.attendanceSchedule]} />
          <Field label="マッチング希望" value={data.matchingPreference === "yes" ? "希望する" : "希望しない"} />
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
        <Field label="部署" value={data.department} />
        <Field label="名前" value={data.name} />
        <Field label="フリガナ" value={data.nameKana} />
        <Field label="メール" value={data.email} />
        <Field label="電話番号" value={data.phone} />
      </Section>
      <Section title="参加情報">
        <Field label="参加日程" value={ATTENDANCE_LABELS[data.attendanceSchedule]} />
        <Field label="来場目的" value={(data.visitPurposes || []).join(", ")} />
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
      <h3 className="font-semibold text-sm text-muted-foreground mb-2 border-b pb-1">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function Field({ label, value, isLink }: { label: string; value?: string | null; isLink?: boolean }) {
  if (!value) return null;
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      {isLink ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">{value}</a>
      ) : (
        <span className="font-medium break-all">{value}</span>
      )}
    </div>
  );
}
