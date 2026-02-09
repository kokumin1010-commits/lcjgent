import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import StaffCard from "@/components/StaffCard";
import type { StaffCardData } from "@/components/StaffCard";
import {
  Loader2, Plus, Search, Users, Building2, Globe, Briefcase,
  LayoutGrid, List, X, Upload, Mail, Phone, MapPin, Calendar,
  Tag, MessageCircle, AlertCircle, FileText, Trash2, Edit, UserPlus,
  ChevronLeft, Camera
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

export default function HRManagement() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [employmentFilter, setEmploymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<StaffFormData>({ ...emptyFormData });
  const [newSkill, setNewSkill] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: staffList, isLoading } = trpc.staff.list.useQuery();
  const { data: stats } = trpc.staff.statistics.useQuery();

  const createMutation = trpc.staff.create.useMutation({
    onSuccess: () => {
      toast.success("スタッフを登録しました");
      utils.staff.list.invalidate();
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
      utils.staff.statistics.invalidate();
      setIsEditMode(false);
      // Refresh selected staff
      if (selectedStaff) {
        const updated = staffList?.find(s => s.id === selectedStaff.id);
        if (updated) setSelectedStaff(updated);
      }
    },
    onError: (error) => toast.error("更新に失敗しました", { description: error.message }),
  });

  const deleteMutation = trpc.staff.delete.useMutation({
    onSuccess: () => {
      toast.success("スタッフを削除しました");
      utils.staff.list.invalidate();
      utils.staff.statistics.invalidate();
      setIsDetailOpen(false);
      setSelectedStaff(null);
    },
    onError: (error) => toast.error("削除に失敗しました", { description: error.message }),
  });

  const uploadAvatarMutation = trpc.staff.uploadAvatar.useMutation({
    onSuccess: (data) => {
      toast.success("プロフィール写真を更新しました");
      utils.staff.list.invalidate();
      if (selectedStaff) {
        setSelectedStaff({ ...selectedStaff, avatarUrl: data.url });
      }
    },
    onError: (error) => toast.error("写真のアップロードに失敗しました", { description: error.message }),
  });

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    if (!staffList) return [];
    return staffList.filter((s) => {
      // Status filter
      if (statusFilter !== "all" && s.isActive !== statusFilter) return false;
      // Department filter
      if (departmentFilter !== "all" && s.department !== departmentFilter) return false;
      // Country filter
      if (countryFilter !== "all" && s.country !== countryFilter) return false;
      // Employment type filter
      if (employmentFilter !== "all" && s.employmentType !== employmentFilter) return false;
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          (s.nameEn && s.nameEn.toLowerCase().includes(q)) ||
          s.email.toLowerCase().includes(q) ||
          (s.department && s.department.toLowerCase().includes(q)) ||
          (s.position && s.position.toLowerCase().includes(q)) ||
          (s.skills && s.skills.some((sk: string) => sk.toLowerCase().includes(q)))
        );
      }
      return true;
    });
  }, [staffList, searchQuery, departmentFilter, countryFilter, employmentFilter, statusFilter]);

  // Get unique departments from data
  const uniqueDepartments = useMemo(() => {
    if (!staffList) return [];
    const depts = new Set(staffList.map(s => s.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [staffList]);

  const handleStaffClick = (staff: StaffCardData) => {
    const fullStaff = staffList?.find(s => s.id === staff.id);
    if (fullStaff) {
      setSelectedStaff(fullStaff);
      setIsDetailOpen(true);
      setIsEditMode(false);
    }
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
    if (!selectedStaff) return;
    updateMutation.mutate({
      id: selectedStaff.id,
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
      isActive: selectedStaff.isActive,
    });
  };

  const openEditMode = () => {
    if (!selectedStaff) return;
    setFormData({
      name: selectedStaff.name || "",
      nameEn: selectedStaff.nameEn || "",
      email: selectedStaff.email || "",
      phone: selectedStaff.phone || "",
      department: selectedStaff.department || "",
      position: selectedStaff.position || "",
      country: selectedStaff.country || "日本",
      joinDate: selectedStaff.joinDate ? new Date(selectedStaff.joinDate).toISOString().split("T")[0] : "",
      birthDate: selectedStaff.birthDate ? new Date(selectedStaff.birthDate).toISOString().split("T")[0] : "",
      skills: selectedStaff.skills || [],
      lineId: selectedStaff.lineId || "",
      emergencyContact: selectedStaff.emergencyContact || "",
      notes: selectedStaff.notes || "",
      employmentType: selectedStaff.employmentType || "fulltime",
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
    if (!file || !selectedStaff) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("ファイルサイズは5MB以下にしてください");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadAvatarMutation.mutate({
        staffId: selectedStaff.id,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            人事管理（HR）
          </h1>
          <p className="text-muted-foreground mt-1">
            LCJスタッフの人事情報を管理します
          </p>
        </div>
        <Button onClick={() => { setFormData({ ...emptyFormData }); setIsCreateDialogOpen(true); }}>
          <UserPlus className="mr-2 h-4 w-4" />
          スタッフ登録
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.activeStaff}</p>
                  <p className="text-xs text-muted-foreground">在籍スタッフ</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{Object.keys(stats.departmentBreakdown).length}</p>
                  <p className="text-xs text-muted-foreground">部署数</p>
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
                  <p className="text-2xl font-bold">{Object.keys(stats.countryBreakdown).length}</p>
                  <p className="text-xs text-muted-foreground">国・地域</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                  <Briefcase className="h-5 w-5 text-orange-600 dark:text-orange-300" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalStaff}</p>
                  <p className="text-xs text-muted-foreground">全スタッフ</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Department & Country Breakdown */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">部署別</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {Object.entries(stats.departmentBreakdown).sort((a, b) => b[1] - a[1]).map(([dept, count]) => (
                  <div key={dept} className="flex items-center justify-between">
                    <span className="text-sm">{dept}</span>
                    <Badge variant="secondary">{count}名</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">国・地域別</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {Object.entries(stats.countryBreakdown).sort((a, b) => b[1] - a[1]).map(([country, count]) => (
                  <div key={country} className="flex items-center justify-between">
                    <span className="text-sm">{country}</span>
                    <Badge variant="secondary">{count}名</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">雇用形態別</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {Object.entries(stats.employmentTypeBreakdown).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm">{EMPLOYMENT_TYPE_LABELS[type] || type}</span>
                    <Badge variant="secondary">{count}名</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="名前、メール、部署、スキルで検索..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全て</SelectItem>
            <SelectItem value="active">在籍中</SelectItem>
            <SelectItem value="inactive">退職済</SelectItem>
          </SelectContent>
        </Select>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="部署" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部署</SelectItem>
            {uniqueDepartments.map(d => <SelectItem key={d as string} value={d as string}>{d as string}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="国" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全国</SelectItem>
            {COUNTRIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={employmentFilter} onValueChange={setEmploymentFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="雇用形態" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全雇用形態</SelectItem>
            {EMPLOYMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
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
            {filteredStaff.map(staff => (
              <StaffCard key={staff.id} staff={staff as any} onClick={handleStaffClick} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredStaff.map(staff => (
              <StaffCard key={staff.id} staff={staff as any} onClick={handleStaffClick} compact />
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
            {!searchQuery && (
              <Button onClick={() => { setFormData({ ...emptyFormData }); setIsCreateDialogOpen(true); }}>
                <UserPlus className="mr-2 h-4 w-4" />
                最初のスタッフを登録
              </Button>
            )}
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

      {/* Staff Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={(open) => { setIsDetailOpen(open); if (!open) { setIsEditMode(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedStaff && !isEditMode ? (
            <>
              {/* Detail View */}
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start gap-4">
                  <div className="relative group">
                    <Avatar className="h-20 w-20 ring-2 ring-background shadow-lg">
                      <AvatarImage src={selectedStaff.avatarUrl || undefined} alt={selectedStaff.name} />
                      <AvatarFallback className={`${getAvatarColor(selectedStaff.name)} text-white text-2xl font-bold`}>
                        {getInitials(selectedStaff.name)}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      <Camera className="h-6 w-6 text-white" />
                    </button>
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
                      <h2 className="text-xl font-bold">{selectedStaff.name}</h2>
                      {selectedStaff.isActive === "active" ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">在籍</Badge>
                      ) : (
                        <Badge variant="secondary">退職</Badge>
                      )}
                    </div>
                    {selectedStaff.nameEn && <p className="text-sm text-muted-foreground">{selectedStaff.nameEn}</p>}
                    {selectedStaff.position && (
                      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5" /> {selectedStaff.position}
                      </p>
                    )}
                    {selectedStaff.department && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" /> {selectedStaff.department}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={openEditMode}>
                      <Edit className="h-4 w-4 mr-1" /> 編集
                    </Button>
                  </div>
                </div>

                {/* Contact Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">連絡先情報</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{selectedStaff.email}</span>
                    </div>
                    {selectedStaff.phone && (
                      <div className="flex items-center gap-3 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{selectedStaff.phone}</span>
                      </div>
                    )}
                    {selectedStaff.lineId && (
                      <div className="flex items-center gap-3 text-sm">
                        <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>LINE: {selectedStaff.lineId}</span>
                      </div>
                    )}
                    {selectedStaff.country && (
                      <div className="flex items-center gap-3 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{selectedStaff.country}</span>
                      </div>
                    )}
                    {selectedStaff.emergencyContact && (
                      <div className="flex items-center gap-3 text-sm">
                        <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>緊急連絡先: {selectedStaff.emergencyContact}</span>
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
                    <div className="flex items-center gap-3 text-sm">
                      <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>雇用形態: {EMPLOYMENT_TYPE_LABELS[selectedStaff.employmentType || "fulltime"]}</span>
                    </div>
                    {selectedStaff.joinDate && (
                      <div className="flex items-center gap-3 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>入社日: {formatDate(selectedStaff.joinDate)}</span>
                      </div>
                    )}
                    {selectedStaff.birthDate && (
                      <div className="flex items-center gap-3 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>生年月日: {formatDate(selectedStaff.birthDate)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Skills */}
                {selectedStaff.skills && selectedStaff.skills.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">スキル・資格</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {selectedStaff.skills.map((skill: string, i: number) => (
                          <Badge key={i} variant="secondary" className="gap-1">
                            <Tag className="h-3 w-3" /> {skill}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Notes */}
                {selectedStaff.notes && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">メモ</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">{selectedStaff.notes}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Actions */}
                <div className="flex justify-between items-center pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    登録日: {formatDate(selectedStaff.createdAt)}
                  </p>
                  <div className="flex gap-2">
                    {selectedStaff.isActive === "active" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          updateMutation.mutate({ id: selectedStaff.id, isActive: "inactive" });
                          setSelectedStaff({ ...selectedStaff, isActive: "inactive" });
                        }}
                      >
                        退職処理
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          updateMutation.mutate({ id: selectedStaff.id, isActive: "active" });
                          setSelectedStaff({ ...selectedStaff, isActive: "active" });
                        }}
                      >
                        復職処理
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4 mr-1" /> 削除
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>スタッフを削除しますか？</AlertDialogTitle>
                          <AlertDialogDescription>
                            この操作は取り消せません。{selectedStaff.name}さんの全情報が完全に削除されます。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate({ id: selectedStaff.id })}>
                            削除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            </>
          ) : selectedStaff && isEditMode ? (
            <>
              {/* Edit View */}
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Edit className="h-5 w-5" />
                  スタッフ情報編集
                </DialogTitle>
                <DialogDescription>{selectedStaff.name}さんの情報を編集します</DialogDescription>
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
