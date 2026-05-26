import { useState, useMemo, useRef, useCallback } from "react";
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
  AlertTriangle, CircleDot, Link2, Link2Off, RefreshCw, UserRoundCog,
  TrendingUp, DollarSign, Award, Star, ChevronRight, Save
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
  "経営", "営業部", "マーケティング部", "運営部", "技術部", "人事部", "経理部", "法務部", "カスタマーサポート", "動画編集部", "デザイン部", "ライバー部", "その他",
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
  staffResignDate: Date | string | null;
  staffResignReason: string | null;
  staffTier: string | null;
  staffEvaluationScore: number | null;
  staffSalary: number | null;
  staffSalaryCurrency: string | null;
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
// Tier System Constants
// ============================================
const TIER_DATA_JPY = [
  { tier: "tier1", name: "Tier 1", title: "ジュニアメンバー", salaryMin: 250000, salaryMax: 300000, currency: "JPY", roles: "アシスタント、データ入力、サポート業務" },
  { tier: "tier2", name: "Tier 2", title: "メンバー", salaryMin: 300000, salaryMax: 380000, currency: "JPY", roles: "運営担当、営業担当、動画編集者" },
  { tier: "tier3", name: "Tier 3", title: "シニアメンバー", salaryMin: 380000, salaryMax: 500000, currency: "JPY", roles: "コア運営、コアBD、AI企画、ライバー管理" },
  { tier: "tier4", name: "Tier 4", title: "リーダー", salaryMin: 500000, salaryMax: 700000, currency: "JPY", roles: "運営Leader、BD Leader、コンテンツLeader" },
  { tier: "tier5", name: "Tier 5", title: "マネージャー", salaryMin: 700000, salaryMax: 1000000, currency: "JPY", roles: "運営マネージャー、営業マネージャー、MCN責任者" },
  { tier: "tier6", name: "Tier 6", title: "事業責任者", salaryMin: 1000000, salaryMax: null, currency: "JPY", roles: "TikTok事業責任者、AI事業責任者" },
];

const TIER_DATA_RMB = [
  { tier: "tier1", name: "Tier 1", title: "初級実行メンバー", salaryMinRMB: 6000, salaryMaxRMB: 8000, salaryMinJPY: 123000, salaryMaxJPY: 164000, roles: "配信アシスタント、運営アシスタント、AI動画編集アシスタント、データ入力" },
  { tier: "tier2", name: "Tier 2", title: "独立実行メンバー", salaryMinRMB: 8000, salaryMaxRMB: 12000, salaryMinJPY: 164000, salaryMaxJPY: 246000, roles: "ライブ運営、TikTok運営、動画編集者、営業担当、店舗運営" },
  { tier: "tier3", name: "Tier 3", title: "コアメンバー", salaryMinRMB: 12000, salaryMaxRMB: 20000, salaryMinJPY: 246000, salaryMaxJPY: 410000, roles: "コア運営、コアBD、ライブコマース運営、AI企画、ライバー管理" },
  { tier: "tier4", name: "Tier 4", title: "Team Leader", salaryMinRMB: 20000, salaryMaxRMB: 35000, salaryMinJPY: 410000, salaryMaxJPY: 718000, roles: "運営Leader、BD Leader、コンテンツLeader" },
  { tier: "tier5", name: "Tier 5", title: "Manager", salaryMinRMB: 35000, salaryMaxRMB: 60000, salaryMinJPY: 718000, salaryMaxJPY: 1230000, roles: "運営マネージャー、営業マネージャー、MCN責任者" },
  { tier: "tier6", name: "Tier 6", title: "事業責任者", salaryMinRMB: 60000, salaryMaxRMB: 120000, salaryMinJPY: 1230000, salaryMaxJPY: 2460000, roles: "TikTok事業責任者、AI事業責任者、エリア責任者" },
];

const EVALUATION_SCORES = [
  { value: -2, label: "-2", description: "期待大幅未達" },
  { value: -1, label: "-1", description: "期待未達" },
  { value: 0, label: "0", description: "基準レベル" },
  { value: 1, label: "+1", description: "期待以上" },
  { value: 2, label: "+2", description: "優秀" },
  { value: 3, label: "+3", description: "卓越" },
  { value: 4, label: "+4", description: "昇格候補" },
];

const TIER_COLORS: Record<string, string> = {
  tier1: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  tier2: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  tier3: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  tier4: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  tier5: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  tier6: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
};

// ============================================
// Organization Overview Component
// ============================================
function OrganizationOverview({ staffList }: { staffList: UnifiedStaffItem[] }) {
  // 部門展開状態管理 (key: "country:dept" 形式)
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const toggleDept = (key: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 国別集計
  const countryStats = useMemo(() => {
    const map: Record<string, { total: number; active: number; departments: Record<string, number>; employmentTypes: Record<string, number> }> = {};
    staffList.forEach(s => {
      const country = s.staffCountry || s.reportStaffCountry || "不明";
      if (!map[country]) map[country] = { total: 0, active: 0, departments: {}, employmentTypes: {} };
      map[country].total++;
      if (s.reportStaffIsActive === "active") map[country].active++;
      const dept = s.staffDepartment || "未設定";
      map[country].departments[dept] = (map[country].departments[dept] || 0) + 1;
      const empType = s.staffEmploymentType || "unknown";
      map[country].employmentTypes[empType] = (map[country].employmentTypes[empType] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([country, data]) => ({ country, ...data }));
  }, [staffList]);

  // 部門別集計
  const departmentStats = useMemo(() => {
    const map: Record<string, { total: number; countries: Record<string, number> }> = {};
    staffList.forEach(s => {
      const dept = s.staffDepartment || "未設定";
      const country = s.staffCountry || s.reportStaffCountry || "不明";
      if (!map[dept]) map[dept] = { total: 0, countries: {} };
      map[dept].total++;
      map[dept].countries[country] = (map[dept].countries[country] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([department, data]) => ({ department, ...data }));
  }, [staffList]);

  // 雇用形態別集計
  const employmentStats = useMemo(() => {
    const map: Record<string, number> = {};
    staffList.forEach(s => {
      const type = s.staffEmploymentType || "unknown";
      map[type] = (map[type] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [staffList]);

  const totalActive = staffList.filter(s => s.reportStaffIsActive === "active").length;
  const totalInactive = staffList.filter(s => s.reportStaffIsActive !== "active").length;

  const COUNTRY_FLAGS: Record<string, string> = {
    "日本": "🇯🇵",
    "中国": "🇨🇳",
    "タイ": "🇹🇭",
    "ベトナム": "🇻🇳",
    "韓国": "🇰🇷",
  };

  const EMP_TYPE_LABELS: Record<string, string> = {
    fulltime: "正社員",
    parttime: "パート",
    contract: "契約社員",
    intern: "インターン",
    unknown: "未設定",
  };

  return (
    <div className="space-y-6">
      {/* 全体サマリー */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{staffList.length}</p>
            <p className="text-sm text-muted-foreground">全スタッフ</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-emerald-600">{totalActive}</p>
            <p className="text-sm text-muted-foreground">在籍</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-red-500">{totalInactive}</p>
            <p className="text-sm text-muted-foreground">退職済</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{countryStats.length}</p>
            <p className="text-sm text-muted-foreground">国・地域</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-purple-600">{departmentStats.length}</p>
            <p className="text-sm text-muted-foreground">部門数</p>
          </CardContent>
        </Card>
      </div>

      {/* 国別分布 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            国別スタッフ分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {countryStats.map(cs => (
              <Card key={cs.country} className="border-2">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <span className="text-2xl">{COUNTRY_FLAGS[cs.country] || "🌐"}</span>
                      {cs.country}
                    </h3>
                    <Badge variant="secondary" className="text-lg px-3 py-1">{cs.active}名</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mb-3">
                    在籍 {cs.active}名 / 全体 {cs.total}名
                  </div>
                  {/* 部門内訳 - クリックでスタッフ名表示 */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">部門別 (クリックで展開)</p>
                    {Object.entries(cs.departments)
                      .sort((a, b) => b[1] - a[1])
                      .map(([dept, count]) => {
                        const deptKey = `${cs.country}:${dept}`;
                        const isExpanded = expandedDepts.has(deptKey);
                        const deptStaff = staffList.filter(s => 
                          (s.staffCountry || s.reportStaffCountry || "不明") === cs.country &&
                          (s.staffDepartment || "未設定") === dept
                        );
                        return (
                          <div key={dept}>
                            <div
                              className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
                              onClick={() => toggleDept(deptKey)}
                            >
                              <span className="truncate flex items-center gap-1">
                                <span className={`text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                                {dept}
                              </span>
                              <span className="font-medium ml-2">{count}名</span>
                            </div>
                            {isExpanded && (
                              <div className="ml-5 mt-1 mb-2 space-y-0.5 border-l-2 border-primary/20 pl-2">
                                {deptStaff.map(s => (
                                  <div key={s.reportStaffId} className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0" />
                                    <span className="font-medium text-foreground">{s.reportStaffName}</span>
                                    {s.staffPosition && <span className="text-muted-foreground">({s.staffPosition})</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                  {/* 雇用形態内訳 */}
                  <div className="mt-3 pt-3 border-t space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">雇用形態</p>
                    {Object.entries(cs.employmentTypes)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between text-sm">
                          <span>{EMP_TYPE_LABELS[type] || type}</span>
                          <span className="font-medium">{count}名</span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 部門別分布 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            部門別スタッフ分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">部門</th>
                  <th className="text-center py-3 px-4 font-semibold">合計</th>
                  {countryStats.map(cs => (
                    <th key={cs.country} className="text-center py-3 px-4 font-semibold">
                      {COUNTRY_FLAGS[cs.country] || "🌐"} {cs.country}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {departmentStats.map(ds => (
                  <tr key={ds.department} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium">{ds.department}</td>
                    <td className="text-center py-3 px-4">
                      <Badge variant="secondary">{ds.total}</Badge>
                    </td>
                    {countryStats.map(cs => (
                      <td key={cs.country} className="text-center py-3 px-4">
                        {ds.countries[cs.country] ? (
                          <span className="font-medium">{ds.countries[cs.country]}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {/* 合計行 */}
                <tr className="bg-muted/30 font-bold">
                  <td className="py-3 px-4">合計</td>
                  <td className="text-center py-3 px-4">
                    <Badge>{staffList.length}</Badge>
                  </td>
                  {countryStats.map(cs => (
                    <td key={cs.country} className="text-center py-3 px-4">{cs.total}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 雇用形態別 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            雇用形態別分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {employmentStats.map(([type, count]) => (
              <div key={type} className="p-4 rounded-lg border text-center">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm text-muted-foreground">{EMP_TYPE_LABELS[type] || type}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ({((count / staffList.length) * 100).toFixed(1)}%)
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Tier System Tab Component
// ============================================
function TierSystemTab({ staffList }: { staffList: UnifiedStaffItem[] }) {
  const [selectedCurrency, setSelectedCurrency] = useState<"jpy" | "rmb">("rmb");
  const [editingStaffId, setEditingStaffId] = useState<number | null>(null);
  const [editTier, setEditTier] = useState<string | null>(null);
  const [editScore, setEditScore] = useState<number | null>(null);
  const [editSalary, setEditSalary] = useState<string>("");
  const [editCurrency, setEditCurrency] = useState<string>("JPY");

  const utils = trpc.useUtils();
  // DB連携: LCJ CoinのTierテンプレートを参照（同じデータを共有）
  const tierTemplatesQuery = trpc.lcjCoin.getTierTemplates.useQuery();
  const updateTierMutation = trpc.staff.updateTier.useMutation({
    onSuccess: () => {
      toast.success("Tier情報を更新しました");
      utils.staff.listReportStaffUnified.invalidate();
      setEditingStaffId(null);
    },
    onError: (error) => toast.error("更新に失敗しました", { description: error.message }),
  });

  const linkedStaff = staffList.filter(s => s.isLinked && s.staffId && s.reportStaffIsActive === "active");

  const tierDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    linkedStaff.forEach(s => {
      const t = s.staffTier || "未設定";
      dist[t] = (dist[t] || 0) + 1;
    });
    return dist;
  }, [linkedStaff]);

  const startEdit = (item: UnifiedStaffItem) => {
    setEditingStaffId(item.staffId);
    setEditTier(item.staffTier || null);
    setEditScore(item.staffEvaluationScore ?? null);
    setEditSalary(item.staffSalary ? String(item.staffSalary) : "");
    setEditCurrency(item.staffSalaryCurrency || "JPY");
  };

  const saveEdit = () => {
    if (!editingStaffId) return;
    updateTierMutation.mutate({
      staffId: editingStaffId,
      tier: editTier,
      evaluationScore: editScore,
      salary: editSalary ? Number(editSalary) : null,
      salaryCurrency: editCurrency,
    });
  };

  const formatSalary = (amount: number, currency: string) => {
    if (currency === "RMB") return `¥${amount.toLocaleString()} RMB`;
    return `¥${amount.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Tier Distribution Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {["tier1", "tier2", "tier3", "tier4", "tier5", "tier6", "未設定"].map((t) => (
          <Card key={t} className="text-center">
            <CardContent className="p-3">
              <Badge className={TIER_COLORS[t] || "bg-gray-100 text-gray-600"}>
                {t === "未設定" ? "未設定" : t.replace("tier", "Tier ")}
              </Badge>
              <p className="text-2xl font-bold mt-1">{tierDistribution[t] || 0}</p>
              <p className="text-[10px] text-muted-foreground">名</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Salary Reference Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              給与基準テーブル
            </CardTitle>
            <div className="flex border rounded-md">
              <button
                className={`px-3 py-1 text-xs font-medium rounded-l-md transition-colors ${selectedCurrency === "jpy" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                onClick={() => setSelectedCurrency("jpy")}
              >
                JPY（円）
              </button>
              <button
                className={`px-3 py-1 text-xs font-medium rounded-r-md transition-colors ${selectedCurrency === "rmb" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                onClick={() => setSelectedCurrency("rmb")}
              >
                RMB（人民元）
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedCurrency === "jpy" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Tier</th>
                    <th className="text-left py-2 px-3 font-medium">位置付け</th>
                    <th className="text-left py-2 px-3 font-medium">月給レンジ</th>
                    <th className="text-left py-2 px-3 font-medium">年収目安</th>
                    <th className="text-left py-2 px-3 font-medium">主な職種</th>
                  </tr>
                </thead>
                <tbody>
                  {TIER_DATA_JPY.map((t) => (
                    <tr key={t.tier} className="border-b last:border-0 hover:bg-accent/50">
                      <td className="py-2.5 px-3">
                        <Badge className={TIER_COLORS[t.tier]}>{t.name}</Badge>
                      </td>
                      <td className="py-2.5 px-3 font-medium">{t.title}</td>
                      <td className="py-2.5 px-3">
                        ¥{(t.salaryMin / 10000).toFixed(0)}万～{t.salaryMax ? `¥${(t.salaryMax / 10000).toFixed(0)}万` : ""}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {(t.salaryMin * 12 / 10000).toFixed(0)}万円～
                      </td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground">{t.roles}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Tier</th>
                    <th className="text-left py-2 px-3 font-medium">位置付け</th>
                    <th className="text-left py-2 px-3 font-medium">月給 (RMB)</th>
                    <th className="text-left py-2 px-3 font-medium">月給 (JPY換算)</th>
                    <th className="text-left py-2 px-3 font-medium">主な職種</th>
                  </tr>
                </thead>
                <tbody>
                  {TIER_DATA_RMB.map((t) => (
                    <tr key={t.tier} className="border-b last:border-0 hover:bg-accent/50">
                      <td className="py-2.5 px-3">
                        <Badge className={TIER_COLORS[t.tier]}>{t.name}</Badge>
                      </td>
                      <td className="py-2.5 px-3 font-medium">{t.title}</td>
                      <td className="py-2.5 px-3">
                        {(t.salaryMinRMB / 1000).toFixed(0)}K～{(t.salaryMaxRMB / 1000).toFixed(0)}K
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        ¥{(t.salaryMinJPY / 10000).toFixed(1)}万～¥{(t.salaryMaxJPY / 10000).toFixed(1)}万
                      </td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground">{t.roles}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evaluation Score Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            ランク内評価基準 (-2～+4)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {EVALUATION_SCORES.map((s) => (
              <div key={s.value} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5">
                <span className={`font-mono font-bold text-sm ${
                  s.value < 0 ? "text-red-600" : s.value === 0 ? "text-gray-600" : s.value >= 3 ? "text-emerald-600" : "text-blue-600"
                }`}>
                  {s.label}
                </span>
                <span className="text-xs text-muted-foreground">{s.description}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            ※ +4で昇格候補。評価軸: 数字責任・実行力・問題解決力・組織貢献・事業理解
          </p>
        </CardContent>
      </Card>

      {/* Staff Tier Assignment Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            スタッフTier設定
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">名前</th>
                  <th className="text-left py-2 px-3 font-medium">国</th>
                  <th className="text-left py-2 px-3 font-medium">部署</th>
                  <th className="text-left py-2 px-3 font-medium">Tier</th>
                  <th className="text-left py-2 px-3 font-medium">評価</th>
                  <th className="text-left py-2 px-3 font-medium">月給</th>
                  <th className="text-left py-2 px-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {linkedStaff.map((item) => (
                  <tr key={item.staffId} className="border-b last:border-0 hover:bg-accent/50">
                    <td className="py-2.5 px-3 font-medium">{item.staffName || item.reportStaffName}</td>
                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className="text-[10px]">{item.reportStaffCountry}</Badge>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{item.staffDepartment || "-"}</td>
                    <td className="py-2.5 px-3">
                      {editingStaffId === item.staffId ? (
                        <Select value={editTier || "none"} onValueChange={v => setEditTier(v === "none" ? null : v)}>
                          <SelectTrigger className="h-8 w-[100px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">未設定</SelectItem>
                            <SelectItem value="tier1">Tier 1</SelectItem>
                            <SelectItem value="tier2">Tier 2</SelectItem>
                            <SelectItem value="tier3">Tier 3</SelectItem>
                            <SelectItem value="tier4">Tier 4</SelectItem>
                            <SelectItem value="tier5">Tier 5</SelectItem>
                            <SelectItem value="tier6">Tier 6</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        item.staffTier ? (
                          <Badge className={TIER_COLORS[item.staffTier] || ""}>
                            {item.staffTier.replace("tier", "Tier ")}
                          </Badge>
                        ) : <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {editingStaffId === item.staffId ? (
                        <Select value={String(editScore ?? "none")} onValueChange={v => setEditScore(v === "none" ? null : Number(v))}>
                          <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-</SelectItem>
                            {EVALUATION_SCORES.map(s => (
                              <SelectItem key={s.value} value={String(s.value)}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        item.staffEvaluationScore !== null ? (
                          <span className={`font-mono font-bold ${
                            item.staffEvaluationScore < 0 ? "text-red-600" : item.staffEvaluationScore === 0 ? "text-gray-600" : item.staffEvaluationScore >= 3 ? "text-emerald-600" : "text-blue-600"
                          }`}>
                            {item.staffEvaluationScore > 0 ? "+" : ""}{item.staffEvaluationScore}
                          </span>
                        ) : <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {editingStaffId === item.staffId ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={editSalary}
                            onChange={e => setEditSalary(e.target.value)}
                            className="h-8 w-[100px]"
                            placeholder="金額"
                          />
                          <Select value={editCurrency} onValueChange={setEditCurrency}>
                            <SelectTrigger className="h-8 w-[70px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="JPY">JPY</SelectItem>
                              <SelectItem value="RMB">RMB</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        item.staffSalary ? (
                          <span>{formatSalary(item.staffSalary, item.staffSalaryCurrency || "JPY")}</span>
                        ) : <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {editingStaffId === item.staffId ? (
                        <div className="flex gap-1">
                          <Button size="sm" variant="default" className="h-7 px-2" onClick={saveEdit} disabled={updateTierMutation.isPending}>
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingStaffId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => startEdit(item)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Main HR Management Component
// ============================================
export default function HRManagement() {
  const [pageTab, setPageTab] = useState<"overview" | "staff" | "tier">("overview");
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
  const [isResignDialogOpen, setIsResignDialogOpen] = useState(false);
  const [resignDate, setResignDate] = useState("");
  const [resignReason, setResignReason] = useState("");
  const [tierEditStaffId, setTierEditStaffId] = useState<number | null>(null);
  const [tierEditValue, setTierEditValue] = useState<string | null>(null);
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

  const resignMutation = trpc.staff.resign.useMutation({
    onSuccess: () => {
      toast.success("退職処理が完了しました");
      utils.staff.listReportStaffUnified.invalidate();
      utils.staff.statistics.invalidate();
      setIsResignDialogOpen(false);
      setIsDetailOpen(false);
      setResignDate("");
      setResignReason("");
    },
    onError: (error) => toast.error("退職処理に失敗しました", { description: error.message }),
  });

  const reinstateMutation = trpc.staff.reinstate.useMutation({
    onSuccess: () => {
      toast.success("復職処理が完了しました");
      utils.staff.listReportStaffUnified.invalidate();
      utils.staff.statistics.invalidate();
      setIsDetailOpen(false);
    },
    onError: (error) => toast.error("復職処理に失敗しました", { description: error.message }),
  });

  const quickTierMutation = trpc.staff.updateTier.useMutation({
    onSuccess: () => {
      toast.success("Tierを更新しました");
      utils.staff.listReportStaffUnified.invalidate();
      setTierEditStaffId(null);
    },
    onError: (error) => toast.error("Tier更新に失敗しました", { description: error.message }),
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
      staffResignDate: item.linkedStaff?.resignDate || null,
      staffResignReason: item.linkedStaff?.resignReason || null,
      staffTier: item.linkedStaff?.tier || null,
      staffEvaluationScore: item.linkedStaff?.evaluationScore ?? null,
      staffSalary: item.linkedStaff?.salary ? Number(item.linkedStaff.salary) : null,
      staffSalaryCurrency: item.linkedStaff?.salaryCurrency || null,
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

  // Form field update helper - uses functional setState to avoid stale closures
  const updateField = useCallback((field: keyof StaffFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Staff form fields - rendered as JSX, not as a component to avoid remounting
  const staffFormFieldsJsx = (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>名前 <span className="text-red-500">*</span></Label>
          <Input value={formData.name} onChange={e => updateField('name', e.target.value)} placeholder="山田 太郎" />
        </div>
        <div className="space-y-2">
          <Label>英語名</Label>
          <Input value={formData.nameEn} onChange={e => updateField('nameEn', e.target.value)} placeholder="Taro Yamada" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>メールアドレス <span className="text-red-500">*</span></Label>
          <Input type="email" value={formData.email} onChange={e => updateField('email', e.target.value)} placeholder="yamada@lcj.co.jp" />
        </div>
        <div className="space-y-2">
          <Label>電話番号</Label>
          <Input value={formData.phone} onChange={e => updateField('phone', e.target.value)} placeholder="090-1234-5678" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>部署</Label>
          <Select value={formData.department || "none"} onValueChange={v => updateField('department', v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="部署を選択" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">未設定</SelectItem>
              {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>役職・ポジション</Label>
          <Input value={formData.position} onChange={e => updateField('position', e.target.value)} placeholder="マネージャー" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>国</Label>
          <Select value={formData.country || "日本"} onValueChange={v => updateField('country', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COUNTRIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>雇用形態</Label>
          <Select value={formData.employmentType} onValueChange={v => updateField('employmentType', v)}>
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
          <Input type="date" value={formData.joinDate} onChange={e => updateField('joinDate', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>生年月日</Label>
          <Input type="date" value={formData.birthDate} onChange={e => updateField('birthDate', e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>LINE ID</Label>
        <Input value={formData.lineId} onChange={e => updateField('lineId', e.target.value)} placeholder="line_id" />
      </div>

      <div className="space-y-2">
        <Label>緊急連絡先</Label>
        <Input value={formData.emergencyContact} onChange={e => updateField('emergencyContact', e.target.value)} placeholder="緊急時の連絡先" />
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
          onChange={e => updateField('notes', e.target.value)}
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
            {/* Tier Badge - clickable */}
            {item.isLinked && item.staffId && (
              <span
                className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-medium cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all ${
                  item.staffTier ? (TIER_COLORS[item.staffTier] || "bg-gray-100 text-gray-600") : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setTierEditStaffId(item.staffId);
                  setTierEditValue(item.staffTier || null);
                }}
                title="クリックしてTierを設定"
              >
                {item.staffTier ? item.staffTier.replace("tier", "T") : "Tier未設定"}
              </span>
            )}
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

      {/* Page Tabs */}
      <div className="flex border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${pageTab === "overview" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setPageTab("overview")}
        >
          <Building2 className="inline h-4 w-4 mr-1.5" />
          組織概要
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${pageTab === "staff" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setPageTab("staff")}
        >
          <Users className="inline h-4 w-4 mr-1.5" />
          スタッフ一覧
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${pageTab === "tier" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setPageTab("tier")}
        >
          <Award className="inline h-4 w-4 mr-1.5" />
          Tier制度・給与基準
        </button>
      </div>

      {/* 組織概要タブ */}
      {pageTab === "overview" && (
        <OrganizationOverview staffList={unifiedStaffList} />
      )}

      {pageTab === "staff" && (<>
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

      </>)}

      {/* Tier制度・給与基準タブ */}
      {pageTab === "tier" && (
        <TierSystemTab staffList={unifiedStaffList} />
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
          {staffFormFieldsJsx}
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
                <div className="flex gap-2 flex-wrap">
                  {/* 退職処理ボタン：在籍中のスタッフ（紐付済・未紐付どちらも） */}
                  {(selectedItem.isLinked ? selectedItem.staffIsActive === "active" : selectedItem.reportStaffIsActive === "active") && (
                    <Button variant="destructive" size="sm" onClick={() => {
                      setResignDate(new Date().toISOString().split('T')[0]);
                      setResignReason("");
                      setIsResignDialogOpen(true);
                    }}>
                      <UserRoundCog className="h-4 w-4 mr-1" /> 退職処理
                    </Button>
                  )}
                  {/* 復職ボタン：退職済みのスタッフ（紐付済・未紐付どちらも） */}
                  {(selectedItem.isLinked ? selectedItem.staffIsActive === "inactive" : selectedItem.reportStaffIsActive === "inactive") && (
                    <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-300 hover:bg-emerald-50" onClick={() => {
                      reinstateMutation.mutate({
                        staffId: selectedItem.staffId || null,
                        reportStaffId: selectedItem.reportStaffId,
                      });
                    }} disabled={reinstateMutation.isPending}>
                      {reinstateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                      復職
                    </Button>
                  )}
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

                        {/* Resign Info */}
                        {selectedItem.staffIsActive === "inactive" && (
                          <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                退職情報
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              {selectedItem.staffResignDate && (
                                <div className="flex items-center gap-3 text-sm">
                                  <Calendar className="h-4 w-4 text-red-500 shrink-0" />
                                  <span>退職日: {formatDate(selectedItem.staffResignDate)}</span>
                                </div>
                              )}
                              {selectedItem.staffResignReason && (
                                <div className="flex items-start gap-3 text-sm">
                                  <FileText className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                  <span>退職理由: {selectedItem.staffResignReason}</span>
                                </div>
                              )}
                              {!selectedItem.staffResignDate && !selectedItem.staffResignReason && (
                                <p className="text-sm text-muted-foreground">退職済み（詳細未登録）</p>
                              )}
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
              {staffFormFieldsJsx}
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

      {/* Resign Confirmation Dialog */}
      <AlertDialog open={isResignDialogOpen} onOpenChange={setIsResignDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              退職処理の確認
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedItem?.staffName || selectedItem?.reportStaffName}さんの退職処理を行います。ステータスが「退職」に変更されますが、日報履歴やタスク履歴はそのまま保持されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="resignDate">退職日 <span className="text-red-500">*</span></Label>
              <Input
                id="resignDate"
                type="date"
                value={resignDate}
                onChange={(e) => setResignDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resignReason">退職理由</Label>
              <Textarea
                id="resignReason"
                placeholder="退職理由を入力（任意）"
                value={resignReason}
                onChange={(e) => setResignReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={!resignDate || resignMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (selectedItem) {
                  resignMutation.mutate({
                    staffId: selectedItem.staffId || null,
                    reportStaffId: selectedItem.reportStaffId,
                    resignDate: resignDate,
                    resignReason: resignReason || undefined,
                  });
                }
              }}
            >
              {resignMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />処理中...</>
              ) : (
                "退職処理を実行"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Tier Edit Dialog */}
      <Dialog open={tierEditStaffId !== null} onOpenChange={(open) => { if (!open) setTierEditStaffId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Tier設定
            </DialogTitle>
            <DialogDescription>
              {unifiedStaffList.find(s => s.staffId === tierEditStaffId)?.staffName || unifiedStaffList.find(s => s.staffId === tierEditStaffId)?.reportStaffName}さんのTierを設定
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              {["tier1", "tier2", "tier3", "tier4", "tier5", "tier6"].map((t) => (
                <button
                  key={t}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                    tierEditValue === t
                      ? "border-primary ring-2 ring-primary/30 " + (TIER_COLORS[t] || "")
                      : "border-transparent " + (TIER_COLORS[t] || "bg-gray-100")
                  }`}
                  onClick={() => setTierEditValue(t)}
                >
                  {t.replace("tier", "Tier ")}
                </button>
              ))}
            </div>
            <button
              className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                tierEditValue === null
                  ? "border-primary ring-2 ring-primary/30 bg-gray-100 dark:bg-gray-800"
                  : "border-transparent bg-gray-100 dark:bg-gray-800 text-muted-foreground"
              }`}
              onClick={() => setTierEditValue(null)}
            >
              未設定に戻す
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTierEditStaffId(null)}>キャンセル</Button>
            <Button
              onClick={() => {
                if (tierEditStaffId) {
                  quickTierMutation.mutate({
                    staffId: tierEditStaffId,
                    tier: tierEditValue,
                    evaluationScore: null,
                    salary: null,
                    salaryCurrency: null,
                  });
                }
              }}
              disabled={quickTierMutation.isPending}
            >
              {quickTierMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />保存中...</> : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
