import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2, Plus, Search, Users, Building2, Globe, Briefcase,
  LayoutGrid, List, X, Upload, Mail, Phone, MapPin, Calendar,
  Tag, MessageCircle, AlertCircle, FileText, Trash2, Edit, UserPlus,
  ChevronLeft, Camera, ClipboardList, BookOpen, CheckCircle2, Clock,
  AlertTriangle, CircleDot, Link2, Link2Off, RefreshCw, UserRoundCog
} from "lucide-react";
import { toast } from "sonner";

const COUNTRIES = [
  { value: "日本", label: "🇯🇵 日本" },
  { value: "中国", label: "🇨🇳 中国" },
  { value: "タイ", label: "🇹🇭 タイ" },
  { value: "ベトナム", label: "🇻🇳 ベトナム" },
  { value: "韓国", label: "🇰🇷 韓国" },
  { value: "その他", label: "その他" },
];

const DEPARTMENTS = [
  "経営", "営業部", "マーケティング部", "運営部", "技術部", "人事部", "経理部", "法務部", "カスタマーサポート", "その他",
];

const EMPLOYMENT_TYPES = [
  { value: "fulltime", label: "正社員" },
  { value: "parttime", label: "パート" },
  { value: "contract", label: "契約社員" },
  { value: "intern", label: "インターン" },
];

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  fulltime: "正社員",
  parttime: "パート",
  contract: "契約社員",
  intern: "インターン",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "未着手", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300", icon: Clock },
  in_progress: { label: "進行中", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", icon: CircleDot },
  completed: { label: "完了", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300", icon: CheckCircle2 },
  cancelled: { label: "キャンセル", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: X },
};

interface StaffFormData {
  name: string;
  nameEn: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  country: string;
  joinDate: string;
  birthDate: string;
  skills: string[];
  lineId: string;
  emergencyContact: string;
  notes: string;
  employmentType: string;
}

const emptyFormData: StaffFormData = {
  name: "",
  nameEn: "",
  email: "",
  phone: "",
  department: "",
  position: "",
  country: "日本",
  joinDate: "",
  birthDate: "",
  skills: [],
  lineId: "",
  emergencyContact: "",
  notes: "",
  employmentType: "fulltime",
};

function getInitials(name: string): string {
  const parts = name.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-rose-500", "bg-pink-500", "bg-fuchsia-500", "bg-purple-500",
    "bg-violet-500", "bg-indigo-500", "bg-blue-500", "bg-sky-500",
    "bg-cyan-500", "bg-teal-500", "bg-emerald-500", "bg-green-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
}

function formatShortDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

// ============================================
// Unified Staff Item type (merging reportStaff + staff)
// ============================================
interface UnifiedStaffItem {
  // reportStaff data
  reportStaffId: number;
  reportStaffName: string;
  reportStaffCountry: string;
  reportStaffIsActive: string;
  // linked staff data (if exists)
  staffId: number | null;
  staffName: string | null;
  staffEmail: string | null;
  staffPhone: string | null;
  staffDepartment: string | null;
  staffPosition: string | null;
  staffCountry: string | null;
  staffAvatarUrl: string | null;
  staffJoinDate: Date | string | null;
  staffBirthDate: Date | string | null;
  staffSkills: string[] | null;
  staffLineId: string | null;
  staffEmergencyContact: string | null;
  staffNotes: string | null;
  staffEmploymentType: string | null;
  staffIsActive: string | null;
  staffNameEn: string | null;
  isLinked: boolean;
}

// Task History Tab Component
function TaskHistoryTab({ staffId }: { staffId: number }) {
  const { data: tasks, isLoading } = trpc.staff.getTaskHistory.useQuery({ staffId });
  const { data: taskCounts } = trpc.staff.getTaskCounts.useQuery({ staffId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Task Summary Cards */}
      {taskCounts && (
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xl font-bold">{taskCounts.totalCount}</p>
            <p className="text-xs text-muted-foreground">全タスク</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xl font-bold text-blue-600">{taskCounts.inProgressCount}</p>
            <p className="text-xs text-muted-foreground">進行中</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xl font-bold text-emerald-600">{taskCounts.completedCount}</p>
            <p className="text-xs text-muted-foreground">完了</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xl font-bold text-red-600">{taskCounts.overdueCount}</p>
            <p className="text-xs text-muted-foreground">期限超過</p>
          </div>
        </div>
      )}

      {/* Completion Rate */}
      {taskCounts && taskCounts.totalCount > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">完了率</span>
            <span className="font-medium">{Math.round((taskCounts.completedCount / taskCounts.totalCount) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${(taskCounts.completedCount / taskCounts.totalCount) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Task List */}
      {!tasks || tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <ClipboardList className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">タスク履歴がありません</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {tasks.map((task) => {
            const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
            const StatusIcon = config.icon;
            return (
              <div key={task.id} className="rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${config.color}`}>
                    <StatusIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{task.taskId}</span>
                      <Badge variant="outline" className={`text-xs shrink-0 ${config.color}`}>
                        {config.label}
                      </Badge>
                    </div>
                    {task.taskDetail && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.taskDetail}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      {task.deadline && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          期限: {formatShortDate(task.deadline)}
                        </span>
                      )}
                      {task.completedAt && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          完了: {formatShortDate(typeof task.completedAt === 'number' ? new Date(task.completedAt) : task.completedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Report History Tab Component - uses reportStaffId directly
function ReportHistoryTab({ reportStaffId, staffId }: { reportStaffId: number; staffId: number | null }) {
  const { data: reports, isLoading } = trpc.staff.getReportsByReportStaffId.useQuery({ reportStaffId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Report Summary */}
      {reports && reports.length > 0 && (
        <div className="rounded-lg border p-3 text-center">
          <p className="text-xl font-bold">{reports.length}</p>
          <p className="text-xs text-muted-foreground">日報件数</p>
        </div>
      )}

      {/* Report List */}
      {!reports || reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">日報履歴がありません</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {reports.map((report: any) => {
            const r = report.report || report;
            return (
              <div key={r.id} className="rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {formatDate(r.reportDate)}
                    </span>
                    <div className="mt-2 space-y-1.5">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">業務内容</p>
                        <p className="text-sm line-clamp-3 whitespace-pre-wrap">{r.workContent}</p>
                      </div>
                      {r.issues && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">気付き・問題</p>
                          <p className="text-sm line-clamp-2 whitespace-pre-wrap text-amber-700 dark:text-amber-400">{r.issues}</p>
                        </div>
                      )}
                      {r.remarks && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">備考</p>
                          <p className="text-sm line-clamp-2 whitespace-pre-wrap text-muted-foreground">{r.remarks}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================
// Main HR Management Component
// ============================================
export default function HRManagement() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [linkFilter, setLinkFilter] = useState("all"); // all, linked, unlinked
  const [statusFilter, setStatusFilter] = useState("active");
  const [selectedItem, setSelectedItem] = useState<UnifiedStaffItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState<StaffFormData>({ ...emptyFormData });
  const [newSkill, setNewSkill] = useState("");
  const [detailTab, setDetailTab] = useState("profile");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  // Fetch reportStaff unified data (reportStaff + linked staff)
  const { data: unifiedData, isLoading } = trpc.staff.listReportStaffUnified.useQuery();
  const { data: stats } = trpc.staff.statistics.useQuery();

  const autoLinkMutation = trpc.staff.autoLinkReportStaff.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.linkedCount}件の紐付けを自動実行しました`);
      utils.staff.listReportStaffUnified.invalidate();
      utils.staff.statistics.invalidate();
    },
    onError: (error) => toast.error("自動紐付けに失敗しました", { description: error.message }),
  });

  const createFromReportStaffMutation = trpc.staff.createFromReportStaff.useMutation({
    onSuccess: () => {
      toast.success("スタッフレコードを作成し紐付けました");
      utils.staff.listReportStaffUnified.invalidate();
      utils.staff.statistics.invalidate();
    },
    onError: (error) => toast.error("作成に失敗しました", { description: error.message }),
  });

  const createMutation = trpc.staff.create.useMutation({
    onSuccess: () => {
      toast.success("スタッフを登録しました");
      utils.staff.list.invalidate();
      utils.staff.listReportStaffUnified.invalidate();
      utils.staff.statistics.invalidate();
      setIsCreateDialogOpen(false);
      setFormData({ ...emptyFormData });
    },
    onError: (error) => toast.error("登録に失敗しました", { description: error.message }),
  });

  const updateMutation = trpc.staff.update.useMutation({
    onSuccess: () => {
      toast.success("スタッフ情報を更新しました");
      utils.staff.list.invalidate();
      utils.staff.listReportStaffUnified.invalidate();
      utils.staff.statistics.invalidate();
      setIsEditMode(false);
    },
    onError: (error) => toast.error("更新に失敗しました", { description: error.message }),
  });

  const uploadAvatarMutation = trpc.staff.uploadAvatar.useMutation({
    onSuccess: (data) => {
      toast.success("プロフィール写真を更新しました");
      utils.staff.list.invalidate();
      utils.staff.listReportStaffUnified.invalidate();
      if (selectedItem) {
        setSelectedItem({ ...selectedItem, staffAvatarUrl: data.url });
      }
    },
    onError: (error) => toast.error("写真のアップロードに失敗しました", { description: error.message }),
  });

  // Transform unified data into UnifiedStaffItem[]
  const unifiedStaffList = useMemo<UnifiedStaffItem[]>(() => {
    if (!unifiedData) return [];
    return unifiedData.map((item: any) => ({
      reportStaffId: item.reportStaff.id,
      reportStaffName: item.reportStaff.name,
      reportStaffCountry: item.reportStaff.country,
      reportStaffIsActive: item.reportStaff.isActive,
      staffId: item.linkedStaff?.id || null,
      staffName: item.linkedStaff?.name || null,
      staffEmail: item.linkedStaff?.email || null,
      staffPhone: item.linkedStaff?.phone || null,
      staffDepartment: item.linkedStaff?.department || null,
      staffPosition: item.linkedStaff?.position || null,
      staffCountry: item.linkedStaff?.country || null,
      staffAvatarUrl: item.linkedStaff?.avatarUrl || null,
      staffJoinDate: item.linkedStaff?.joinDate || null,
      staffBirthDate: item.linkedStaff?.birthDate || null,
      staffSkills: item.linkedStaff?.skills || null,
      staffLineId: item.linkedStaff?.lineId || null,
      staffEmergencyContact: item.linkedStaff?.emergencyContact || null,
      staffNotes: item.linkedStaff?.notes || null,
      staffEmploymentType: item.linkedStaff?.employmentType || null,
      staffIsActive: item.linkedStaff?.isActive || null,
      staffNameEn: item.linkedStaff?.nameEn || null,
      isLinked: !!item.linkedStaff,
    }));
  }, [unifiedData]);

  // Filter staff
  const filteredStaff = useMemo(() => {
    return unifiedStaffList.filter((s) => {
      if (statusFilter !== "all" && s.reportStaffIsActive !== statusFilter) return false;
      if (countryFilter !== "all" && s.reportStaffCountry !== countryFilter) return false;
      if (linkFilter === "linked" && !s.isLinked) return false;
      if (linkFilter === "unlinked" && s.isLinked) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          s.reportStaffName.toLowerCase().includes(q) ||
          (s.staffName && s.staffName.toLowerCase().includes(q)) ||
          (s.staffNameEn && s.staffNameEn.toLowerCase().includes(q)) ||
          (s.staffEmail && s.staffEmail.toLowerCase().includes(q)) ||
          (s.staffDepartment && s.staffDepartment.toLowerCase().includes(q)) ||
          (s.staffPosition && s.staffPosition.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [unifiedStaffList, searchQuery, countryFilter, linkFilter, statusFilter]);

  const linkedCount = useMemo(() => unifiedStaffList.filter(s => s.isLinked).length, [unifiedStaffList]);
  const unlinkedCount = useMemo(() => unifiedStaffList.filter(s => !s.isLinked).length, [unifiedStaffList]);

  const handleStaffClick = (item: UnifiedStaffItem) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
    setIsEditMode(false);
    setDetailTab("profile");
  };

  const handleCreate = () => {
    if (!formData.name || !formData.email) {
      toast.error("名前とメールアドレスは必須です");
      return;
    }
    createMutation.mutate({
      name: formData.name,
      nameEn: formData.nameEn || undefined,
      email: formData.email,
      phone: formData.phone || undefined,
      department: formData.department || undefined,
      position: formData.position || undefined,
      country: formData.country || undefined,
      joinDate: formData.joinDate || undefined,
      birthDate: formData.birthDate || undefined,
      skills: formData.skills.length > 0 ? formData.skills : undefined,
      lineId: formData.lineId || undefined,
      emergencyContact: formData.emergencyContact || undefined,
      notes: formData.notes || undefined,
      employmentType: (formData.employmentType as any) || undefined,
    });
  };

  const handleUpdate = () => {
    if (!selectedItem?.staffId) return;
    updateMutation.mutate({
      id: selectedItem.staffId,
      name: formData.name || undefined,
      nameEn: formData.nameEn || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      department: formData.department || undefined,
      position: formData.position || undefined,
      country: formData.country || undefined,
      joinDate: formData.joinDate || null,
      birthDate: formData.birthDate || null,
      skills: formData.skills.length > 0 ? formData.skills : undefined,
      lineId: formData.lineId || undefined,
      emergencyContact: formData.emergencyContact || undefined,
      notes: formData.notes || undefined,
      employmentType: (formData.employmentType as any) || undefined,
      isActive: (selectedItem.staffIsActive as "active" | "inactive") || "active",
    });
  };

  const openEditMode = () => {
    if (!selectedItem) return;
    setFormData({
      name: selectedItem.staffName || selectedItem.reportStaffName || "",
      nameEn: selectedItem.staffNameEn || "",
      email: selectedItem.staffEmail || "",
      phone: selectedItem.staffPhone || "",
      department: selectedItem.staffDepartment || "",
      position: selectedItem.staffPosition || "",
      country: selectedItem.staffCountry || selectedItem.reportStaffCountry || "日本",
      joinDate: selectedItem.staffJoinDate ? new Date(selectedItem.staffJoinDate as string).toISOString().split("T")[0] : "",
      birthDate: selectedItem.staffBirthDate ? new Date(selectedItem.staffBirthDate as string).toISOString().split("T")[0] : "",
      skills: selectedItem.staffSkills || [],
      lineId: selectedItem.staffLineId || "",
      emergencyContact: selectedItem.staffEmergencyContact || "",
      notes: selectedItem.staffNotes || "",
      employmentType: selectedItem.staffEmploymentType || "fulltime",
    });
    setIsEditMode(true);
  };

  const addSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData({ ...formData, skills: [...formData.skills, newSkill.trim()] });
      setNewSkill("");
    }
  };

  const removeSkill = (skill: string) => {
    setFormData({ ...formData, skills: formData.skills.filter(s => s !== skill) });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedItem?.staffId) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("ファイルサイズは5MB以下にしてください");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadAvatarMutation.mutate({
        staffId: selectedItem.staffId!,
        base64,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  // Staff form fields component
  const StaffFormFields = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>名前 <span className="text-red-500">*</span></Label>
          <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="山田 太郎" />
        </div>
        <div className="space-y-2">
          <Label>英語名</Label>
          <Input value={formData.nameEn} onChange={e => setFormData({ ...formData, nameEn: e.target.value })} placeholder="Taro Yamada" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>メールアドレス <span className="text-red-500">*</span></Label>
          <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="yamada@lcj.co.jp" />
        </div>
        <div className="space-y-2">
          <Label>電話番号</Label>
          <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="090-1234-5678" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>部署</Label>
          <Select value={formData.department || "none"} onValueChange={v => setFormData({ ...formData, department: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="部署を選択" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">未設定</SelectItem>
              {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>役職・ポジション</Label>
          <Input value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })} placeholder="マネージャー" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>国</Label>
          <Select value={formData.country || "日本"} onValueChange={v => setFormData({ ...formData, country: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COUNTRIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>雇用形態</Label>
          <Select value={formData.employmentType} onValueChange={v => setFormData({ ...formData, employmentType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EMPLOYMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>入社日</Label>
          <Input type="date" value={formData.joinDate} onChange={e => setFormData({ ...formData, joinDate: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>生年月日</Label>
          <Input type="date" value={formData.birthDate} onChange={e => setFormData({ ...formData, birthDate: e.target.value })} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>LINE ID</Label>
        <Input value={formData.lineId} onChange={e => setFormData({ ...formData, lineId: e.target.value })} placeholder="line_id" />
      </div>

      <div className="space-y-2">
        <Label>緊急連絡先</Label>
        <Input value={formData.emergencyContact} onChange={e => setFormData({ ...formData, emergencyContact: e.target.value })} placeholder="緊急時の連絡先" />
      </div>

      {/* Skills */}
      <div className="space-y-2">
        <Label>スキル・資格</Label>
        <div className="flex gap-2">
          <Input
            value={newSkill}
            onChange={e => setNewSkill(e.target.value)}
            placeholder="スキルを入力"
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
          />
          <Button type="button" variant="outline" size="sm" onClick={addSkill}>追加</Button>
        </div>
        {formData.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {formData.skills.map((skill, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                {skill}
                <X className="h-3 w-3 cursor-pointer" onClick={() => removeSkill(skill)} />
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>メモ</Label>
        <Textarea
          value={formData.notes}
          onChange={e => setFormData({ ...formData, notes: e.target.value })}
          placeholder="備考・メモ"
          rows={3}
        />
      </div>
    </div>
  );

  // ============================================
  // Staff Card for unified view
  // ============================================
  const UnifiedStaffCard = ({ item, compact = false }: { item: UnifiedStaffItem; compact?: boolean }) => {
    const name = item.staffName || item.reportStaffName;
    const avatarColor = getAvatarColor(name);
    const initials = getInitials(name);
    const isActive = item.reportStaffIsActive === "active";

    if (compact) {
      return (
        <Card
          className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 ${!isActive ? "opacity-60" : ""}`}
          onClick={() => handleStaffClick(item)}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={item.staffAvatarUrl || undefined} alt={name} />
                <AvatarFallback className={`${avatarColor} text-white text-sm font-medium`}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{name}</p>
                  {item.isLinked ? (
                    <Link2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <Link2Off className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  )}
                  {!isActive && <Badge variant="secondary" className="text-[10px] px-1 py-0">退職</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {item.staffPosition || item.staffDepartment || item.staffEmail || item.reportStaffCountry}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {item.reportStaffCountry}
              </Badge>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card
        className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 ${!isActive ? "opacity-60" : ""}`}
        onClick={() => handleStaffClick(item)}
      >
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <Avatar className="h-14 w-14 shrink-0 ring-2 ring-background shadow-sm">
              <AvatarImage src={item.staffAvatarUrl || undefined} alt={name} />
              <AvatarFallback className={`${avatarColor} text-white text-lg font-semibold`}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base truncate">{name}</h3>
                {isActive ? (
                  <span className="inline-flex items-center h-5 px-1.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                    在籍
                  </span>
                ) : (
                  <span className="inline-flex items-center h-5 px-1.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    退職
                  </span>
                )}
              </div>
              {item.staffNameEn && (
                <p className="text-xs text-muted-foreground mt-0.5">{item.staffNameEn}</p>
              )}
              {item.staffPosition && (
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {item.staffPosition}
                </p>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="space-y-2 text-sm">
            {item.staffDepartment && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.staffDepartment}</span>
              </div>
            )}
            {item.staffEmail && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.staffEmail}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{item.reportStaffCountry}</span>
            </div>
          </div>

          {/* Tags */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.isLinked ? (
              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                <Link2 className="h-2.5 w-2.5" /> HR紐付済
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
                <Link2Off className="h-2.5 w-2.5" /> 未紐付
              </span>
            )}
            {item.staffEmploymentType && (
              <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {EMPLOYMENT_TYPE_LABELS[item.staffEmploymentType] || item.staffEmploymentType}
              </span>
            )}
            {item.staffSkills && item.staffSkills.length > 0 && (
              <>
                {item.staffSkills.slice(0, 2).map((skill, i) => (
                  <span key={i} className="inline-flex items-center gap-0.5 h-5 px-2 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <Tag className="h-2.5 w-2.5" /> {skill}
                  </span>
                ))}
                {item.staffSkills.length > 2 && (
                  <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    +{item.staffSkills.length - 2}
                  </span>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UserRoundCog className="h-7 w-7 text-primary" />
            人事管理（HR）
          </h1>
          <p className="text-muted-foreground mt-1">
            日報スタッフを中心にLCJスタッフの人事情報を管理します
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => autoLinkMutation.mutate()}
            disabled={autoLinkMutation.isPending}
          >
            {autoLinkMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            自動紐付け
          </Button>
          <Button onClick={() => { setFormData({ ...emptyFormData }); setIsCreateDialogOpen(true); }}>
            <UserPlus className="mr-2 h-4 w-4" />
            スタッフ登録
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unifiedStaffList.length}</p>
                <p className="text-xs text-muted-foreground">全スタッフ</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                <Link2 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              </div>
              <div>
                <p className="text-2xl font-bold">{linkedCount}</p>
                <p className="text-xs text-muted-foreground">HR紐付済</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                <Link2Off className="h-5 w-5 text-amber-600 dark:text-amber-300" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unlinkedCount}</p>
                <p className="text-xs text-muted-foreground">未紐付</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <Globe className="h-5 w-5 text-purple-600 dark:text-purple-300" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {new Set(unifiedStaffList.map(s => s.reportStaffCountry)).size}
                </p>
                <p className="text-xs text-muted-foreground">国・地域</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="名前、メール、部署で検索..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全ステータス</SelectItem>
            <SelectItem value="active">在籍</SelectItem>
            <SelectItem value="inactive">退職</SelectItem>
          </SelectContent>
        </Select>
        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全国</SelectItem>
            {COUNTRIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={linkFilter} onValueChange={setLinkFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全紐付状態</SelectItem>
            <SelectItem value="linked">紐付済</SelectItem>
            <SelectItem value="unlinked">未紐付</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="icon"
            className="rounded-r-none"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="icon"
            className="rounded-l-none"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filteredStaff.length}名のスタッフ
        {searchQuery && ` （「${searchQuery}」で検索）`}
      </div>

      {/* Staff Grid/List */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredStaff.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredStaff.map(item => (
              <UnifiedStaffCard key={item.reportStaffId} item={item} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredStaff.map(item => (
              <UnifiedStaffCard key={item.reportStaffId} item={item} compact />
            ))}
          </div>
        )
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center min-h-[300px] text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground mb-2">
              {searchQuery ? "検索結果がありません" : "スタッフが登録されていません"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Create Staff Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              新規スタッフ登録
            </DialogTitle>
            <DialogDescription>スタッフの人事情報を入力してください</DialogDescription>
          </DialogHeader>
          <StaffFormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />登録中...</> : "登録"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Detail Dialog with Tabs */}
      <Dialog open={isDetailOpen} onOpenChange={(open) => { setIsDetailOpen(open); if (!open) { setIsEditMode(false); setDetailTab("profile"); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          {selectedItem && !isEditMode ? (
            <>
              {/* Header */}
              <div className="flex items-start gap-4 pb-4 border-b shrink-0">
                <div className="relative group">
                  <Avatar className="h-16 w-16 ring-2 ring-background shadow-lg">
                    <AvatarImage src={selectedItem.staffAvatarUrl || undefined} alt={selectedItem.reportStaffName} />
                    <AvatarFallback className={`${getAvatarColor(selectedItem.reportStaffName)} text-white text-xl font-bold`}>
                      {getInitials(selectedItem.reportStaffName)}
                    </AvatarFallback>
                  </Avatar>
                  {selectedItem.isLinked && (
                    <button
                      className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      <Camera className="h-5 w-5 text-white" />
                    </button>
                  )}
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold">{selectedItem.staffName || selectedItem.reportStaffName}</h2>
                    {selectedItem.reportStaffIsActive === "active" ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">在籍</Badge>
                    ) : (
                      <Badge variant="secondary">退職</Badge>
                    )}
                    {selectedItem.isLinked ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 gap-1">
                        <Link2 className="h-3 w-3" /> HR紐付済
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1">
                        <Link2Off className="h-3 w-3" /> 未紐付
                      </Badge>
                    )}
                  </div>
                  {selectedItem.staffNameEn && <p className="text-sm text-muted-foreground">{selectedItem.staffNameEn}</p>}
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    {selectedItem.staffPosition && (
                      <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {selectedItem.staffPosition}</span>
                    )}
                    {selectedItem.staffDepartment && (
                      <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {selectedItem.staffDepartment}</span>
                    )}
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {selectedItem.reportStaffCountry}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {selectedItem.isLinked ? (
                    <Button variant="outline" size="sm" onClick={openEditMode}>
                      <Edit className="h-4 w-4 mr-1" /> 編集
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        createFromReportStaffMutation.mutate({
                          reportStaffId: selectedItem.reportStaffId,
                          email: `${selectedItem.reportStaffName.toLowerCase().replace(/\s+/g, '.')}@lcj.placeholder`,
                        });
                        setIsDetailOpen(false);
                      }}
                      disabled={createFromReportStaffMutation.isPending}
                    >
                      {createFromReportStaffMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Link2 className="mr-2 h-4 w-4" />
                      )}
                      HR紐付け
                    </Button>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={detailTab} onValueChange={setDetailTab} className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="grid w-full grid-cols-3 shrink-0">
                  <TabsTrigger value="profile" className="gap-1.5">
                    <Users className="h-4 w-4" />
                    プロフィール
                  </TabsTrigger>
                  <TabsTrigger value="tasks" className="gap-1.5" disabled={!selectedItem.isLinked}>
                    <ClipboardList className="h-4 w-4" />
                    タスク履歴
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="gap-1.5">
                    <BookOpen className="h-4 w-4" />
                    日報履歴
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-y-auto mt-4">
                  <TabsContent value="profile" className="mt-0 space-y-4">
                    {/* Report Staff Info */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          日報スタッフ情報
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-muted-foreground w-24">日報名:</span>
                          <span className="font-medium">{selectedItem.reportStaffName}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-muted-foreground w-24">国:</span>
                          <span>{selectedItem.reportStaffCountry}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-muted-foreground w-24">ID:</span>
                          <span className="font-mono text-xs">{selectedItem.reportStaffId}</span>
                        </div>
                      </CardContent>
                    </Card>

                    {selectedItem.isLinked ? (
                      <>
                        {/* Contact Info */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">連絡先情報</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {selectedItem.staffEmail && (
                              <div className="flex items-center gap-3 text-sm">
                                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span>{selectedItem.staffEmail}</span>
                              </div>
                            )}
                            {selectedItem.staffPhone && (
                              <div className="flex items-center gap-3 text-sm">
                                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span>{selectedItem.staffPhone}</span>
                              </div>
                            )}
                            {selectedItem.staffLineId && (
                              <div className="flex items-center gap-3 text-sm">
                                <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span>LINE: {selectedItem.staffLineId}</span>
                              </div>
                            )}
                            {selectedItem.staffEmergencyContact && (
                              <div className="flex items-center gap-3 text-sm">
                                <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span>緊急連絡先: {selectedItem.staffEmergencyContact}</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Employment Info */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">雇用情報</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {selectedItem.staffEmploymentType && (
                              <div className="flex items-center gap-3 text-sm">
                                <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span>雇用形態: {EMPLOYMENT_TYPE_LABELS[selectedItem.staffEmploymentType]}</span>
                              </div>
                            )}
                            {selectedItem.staffJoinDate && (
                              <div className="flex items-center gap-3 text-sm">
                                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span>入社日: {formatDate(selectedItem.staffJoinDate)}</span>
                              </div>
                            )}
                            {selectedItem.staffBirthDate && (
                              <div className="flex items-center gap-3 text-sm">
                                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span>生年月日: {formatDate(selectedItem.staffBirthDate)}</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Skills */}
                        {selectedItem.staffSkills && selectedItem.staffSkills.length > 0 && (
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-medium">スキル・資格</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="flex flex-wrap gap-2">
                                {selectedItem.staffSkills.map((skill: string, i: number) => (
                                  <Badge key={i} variant="secondary" className="gap-1">
                                    <Tag className="h-3 w-3" /> {skill}
                                  </Badge>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Notes */}
                        {selectedItem.staffNotes && (
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-medium">メモ</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm whitespace-pre-wrap">{selectedItem.staffNotes}</p>
                            </CardContent>
                          </Card>
                        )}
                      </>
                    ) : (
                      <Card>
                        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                          <Link2Off className="h-10 w-10 text-amber-400 mb-3" />
                          <p className="text-sm font-medium mb-1">HR情報が未紐付です</p>
                          <p className="text-xs text-muted-foreground mb-4">
                            「HR紐付け」ボタンをクリックしてスタッフレコードを作成し、詳細情報を登録できます
                          </p>
                          <Button
                            size="sm"
                            onClick={() => {
                              createFromReportStaffMutation.mutate({
                                reportStaffId: selectedItem.reportStaffId,
                                email: `${selectedItem.reportStaffName.toLowerCase().replace(/\s+/g, '.')}@lcj.placeholder`,
                              });
                              setIsDetailOpen(false);
                            }}
                            disabled={createFromReportStaffMutation.isPending}
                          >
                            {createFromReportStaffMutation.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Link2 className="mr-2 h-4 w-4" />
                            )}
                            HR紐付けを実行
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="tasks" className="mt-0">
                    {selectedItem.staffId ? (
                      <TaskHistoryTab staffId={selectedItem.staffId} />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <ClipboardList className="h-10 w-10 text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">HR紐付けが必要です</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="reports" className="mt-0">
                    <ReportHistoryTab reportStaffId={selectedItem.reportStaffId} staffId={selectedItem.staffId} />
                  </TabsContent>
                </div>
              </Tabs>
            </>
          ) : selectedItem && isEditMode ? (
            <>
              {/* Edit View */}
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Edit className="h-5 w-5" />
                  スタッフ情報編集
                </DialogTitle>
                <DialogDescription>{selectedItem.staffName || selectedItem.reportStaffName}さんの情報を編集します</DialogDescription>
              </DialogHeader>
              <StaffFormFields isEdit />
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditMode(false)}>キャンセル</Button>
                <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />更新中...</> : "更新"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
