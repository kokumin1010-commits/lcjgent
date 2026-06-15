/**
 * LCF イベント申込管理
 * - 企業・ライバー・一般の3タブで申し込み一覧を表示
 * - ステータス変更・メモ追加・CSVエクスポート
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
import { Loader2, Building2, Mic2, Users, Download, Search, ExternalLink, PartyPopper } from "lucide-react";
import { toast } from "sonner";

type TabType = "company" | "liver" | "general";
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

export default function FestivalAdmin() {
  const [activeTab, setActiveTab] = useState<TabType>("company");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [detailDialog, setDetailDialog] = useState<{ type: TabType; data: any } | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ type: TabType; id: number; currentStatus: StatusType } | null>(null);
  const [newStatus, setNewStatus] = useState<StatusType>("new");
  const [statusNotes, setStatusNotes] = useState("");

  // Queries
  const { data: stats, isLoading: statsLoading } = trpc.festival.stats.useQuery({ eventYear: "2026" });
  const { data: companyList, isLoading: companyLoading, refetch: refetchCompany } = trpc.festival.listCompany.useQuery({ eventYear: "2026" });
  const { data: liverList, isLoading: liverLoading, refetch: refetchLiver } = trpc.festival.listLiver.useQuery({ eventYear: "2026" });
  const { data: generalList, isLoading: generalLoading, refetch: refetchGeneral } = trpc.festival.listGeneral.useQuery({ eventYear: "2026" });

  // Mutations
  const updateStatus = trpc.festival.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("ステータスを更新しました");
      refetchCompany();
      refetchLiver();
      refetchGeneral();
      setStatusDialog(null);
    },
    onError: (err) => toast.error(`更新失敗: ${err.message}`),
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

  // Filter logic
  const filterData = (data: any[] | undefined) => {
    if (!data) return [];
    return data.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesSearch = searchTerm === "" || 
        JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  };

  // CSV Export
  const exportCsv = (type: TabType) => {
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
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { key: "company" as TabType, label: "企業様", icon: Building2, count: stats?.company || 0 },
    { key: "liver" as TabType, label: "ライバー", icon: Mic2, count: stats?.liver || 0 },
    { key: "general" as TabType, label: "一般参加", icon: Users, count: stats?.general || 0 },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <PartyPopper className="h-7 w-7 text-amber-500" />
          <div>
            <h1 className="text-2xl font-bold">LCF イベント申込管理</h1>
            <p className="text-sm text-muted-foreground">Live Commerce Festival 2026 申込データ</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-base px-3 py-1">
            合計: {stats?.total || 0} 件
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tabs.map((tab) => (
          <Card
            key={tab.key}
            className={`cursor-pointer transition-all hover:shadow-md ${activeTab === tab.key ? "ring-2 ring-primary" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div className={`p-3 rounded-lg ${activeTab === tab.key ? "bg-primary/10" : "bg-muted"}`}>
                <tab.icon className={`h-6 w-6 ${activeTab === tab.key ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{tab.label}</p>
                <p className="text-2xl font-bold">{tab.count}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全て</SelectItem>
            <SelectItem value="new">新規</SelectItem>
            <SelectItem value="confirmed">確認済み</SelectItem>
            <SelectItem value="rejected">却下</SelectItem>
            <SelectItem value="cancelled">キャンセル</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => exportCsv(activeTab)}>
          <Download className="h-4 w-4 mr-2" />
          CSV出力
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {activeTab === "company" && (
            <CompanyTable
              data={filterData(companyList)}
              loading={companyLoading}
              onDetail={(d) => setDetailDialog({ type: "company", data: d })}
              onStatusChange={(id, status) => { setStatusDialog({ type: "company", id, currentStatus: status }); setNewStatus(status); setStatusNotes(""); }}
            />
          )}
          {activeTab === "liver" && (
            <LiverTable
              data={filterData(liverList)}
              loading={liverLoading}
              onDetail={(d) => setDetailDialog({ type: "liver", data: d })}
              onStatusChange={(id, status) => { setStatusDialog({ type: "liver", id, currentStatus: status }); setNewStatus(status); setStatusNotes(""); }}
            />
          )}
          {activeTab === "general" && (
            <GeneralTable
              data={filterData(generalList)}
              loading={generalLoading}
              onDetail={(d) => setDetailDialog({ type: "general", data: d })}
              onStatusChange={(id, status) => { setStatusDialog({ type: "general", id, currentStatus: status }); setNewStatus(status); setStatusNotes(""); }}
            />
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      {detailDialog && (
        <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {detailDialog.type === "company" ? "企業申込み詳細" : detailDialog.type === "liver" ? "ライバー申込み詳細" : "一般参加申込み詳細"}
              </DialogTitle>
            </DialogHeader>
            <DetailView type={detailDialog.type} data={detailDialog.data} />
          </DialogContent>
        </Dialog>
      )}

      {/* Status Change Dialog */}
      {statusDialog && (
        <Dialog open={!!statusDialog} onOpenChange={() => setStatusDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ステータス変更</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as StatusType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">新規</SelectItem>
                  <SelectItem value="confirmed">確認済み</SelectItem>
                  <SelectItem value="rejected">却下</SelectItem>
                  <SelectItem value="cancelled">キャンセル</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                placeholder="メモ（任意）"
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStatusDialog(null)}>キャンセル</Button>
              <Button onClick={handleStatusUpdate} disabled={updateStatus.isPending}>
                {updateStatus.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                更新
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// === Company Table ===
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
            <TableHead>電話</TableHead>
            <TableHead>TikTok Shop</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead>申込日</TableHead>
            <TableHead className="w-[80px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onDetail(item)}>
              <TableCell className="font-mono text-xs">{item.id}</TableCell>
              <TableCell className="font-medium max-w-[200px] truncate">{item.companyName}</TableCell>
              <TableCell>{item.contactName}</TableCell>
              <TableCell className="text-xs">{item.email}</TableCell>
              <TableCell className="text-xs">{item.phone}</TableCell>
              <TableCell className="text-xs max-w-[120px] truncate">{item.tiktokShopSellerName}</TableCell>
              <TableCell>
                <StatusBadge status={item.status} onClick={(e) => { e.stopPropagation(); onStatusChange(item.id, item.status); }} />
              </TableCell>
              <TableCell className="text-xs">{new Date(item.createdAt).toLocaleDateString("ja-JP")}</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDetail(item); }}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// === Liver Table ===
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
            <TableHead className="w-[80px]">操作</TableHead>
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
              <TableCell>
                <Badge variant="outline" className="text-xs">{ATTENDANCE_LABELS[item.attendanceSchedule]}</Badge>
              </TableCell>
              <TableCell className="text-xs">{item.matchingPreference === "yes" ? "希望する" : "希望しない"}</TableCell>
              <TableCell>
                <StatusBadge status={item.status} onClick={(e) => { e.stopPropagation(); onStatusChange(item.id, item.status); }} />
              </TableCell>
              <TableCell className="text-xs">{new Date(item.createdAt).toLocaleDateString("ja-JP")}</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDetail(item); }}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// === General Table ===
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
            <TableHead className="w-[80px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onDetail(item)}>
              <TableCell className="font-mono text-xs">{item.id}</TableCell>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell className="text-xs">{item.companyName}</TableCell>
              <TableCell className="text-xs">{item.email}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">{item.participationType === "corporate" ? "法人" : "個人"}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">{ATTENDANCE_LABELS[item.attendanceSchedule]}</Badge>
              </TableCell>
              <TableCell className="text-xs max-w-[150px] truncate">{(item.visitPurposes || []).join(", ")}</TableCell>
              <TableCell>
                <StatusBadge status={item.status} onClick={(e) => { e.stopPropagation(); onStatusChange(item.id, item.status); }} />
              </TableCell>
              <TableCell className="text-xs">{new Date(item.createdAt).toLocaleDateString("ja-JP")}</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDetail(item); }}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// === Status Badge ===
function StatusBadge({ status, onClick }: { status: string; onClick: (e: React.MouseEvent) => void }) {
  const config = STATUS_CONFIG[status as StatusType] || STATUS_CONFIG.new;
  return (
    <Badge
      className={`${config.color} text-white cursor-pointer hover:opacity-80`}
      onClick={onClick}
    >
      {config.label}
    </Badge>
  );
}

// === Detail View ===
function DetailView({ type, data }: { type: TabType; data: any }) {
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

  // general
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
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">
          {value}
        </a>
      ) : (
        <span className="font-medium break-all">{value}</span>
      )}
    </div>
  );
}
