/**
 * System User Management Page - 后台员工账号管理 + 权限管理
 * 
 * Three tabs:
 * 1. Staff Accounts (员工账号) - manage login accounts, assign roles
 * 2. Role Management (角色管理) - create/edit/delete roles
 * 3. Permission Config (权限配置) - configure which pages each role can access
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Users,
  Shield,
  ShieldOff,
  UserCheck,
  UserX,
  UserCog,
  Trash2,
  MoreHorizontal,
  RefreshCw,
  AlertTriangle,
  Plus,
  Edit,
  Settings,
  Lock,
  Save,
  Building2,
  Crown,
} from "lucide-react";
import { Bell, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ADMIN_MENU_GROUPS } from "@/lib/adminMenuConfig";
import {
  USER_MANAGEMENT_LEVEL_LABELS,
  type EffectiveUserManagementLevel,
  type UserManagementLevel,
} from "@shared/userManagementHierarchy";

// Permission configuration and sidebar share one source of truth.
const ALL_PAGES = [
  { key: "/master", label: "主页", labelJa: "ホーム", group: "dashboard" },
  ...ADMIN_MENU_GROUPS.flatMap((group) =>
    group.items.map((item) => ({
      key: item.path,
      label: item.labelZh,
      labelJa: item.labelJa,
      group: group.id,
    })),
  ),
];

const PAGE_GROUPS = [
  { id: "dashboard", label: "主页", labelJa: "ホーム" },
  ...ADMIN_MENU_GROUPS.map((group) => ({
    id: group.id,
    label: group.labelZh,
    labelJa: group.labelJa,
  })),
];

type ConfirmAction = {
  type: "delete" | "disable" | "enable";
  userId: number;
  userName?: string;
};

type ManagementAccess = {
  userId: number;
  level: EffectiveUserManagementLevel;
  managedDepartment: string | null;
  canManageAccounts: boolean;
  isSuperAdmin: boolean;
};

export default function SystemUserManagement() {
  const { language } = useLanguage();
  const { user: currentUser } = useAuth();
  const isZh = language === "zh";
  const accessQuery = trpc.userManagement.myAccess.useQuery();
  const access = accessQuery.data as ManagementAccess | undefined;

  if (accessQuery.isLoading) {
    return (
      <div className="p-6 flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!access?.canManageAccounts) {
    return (
      <div className="p-6">
        <Card className="max-w-2xl border-amber-200 bg-amber-50/60">
          <CardContent className="p-8 text-center">
            <ShieldOff className="h-10 w-10 mx-auto mb-3 text-amber-600" />
            <h1 className="text-xl font-bold">
              {isZh ? "没有员工账号管理权限" : "スタッフアカウント管理権限がありません"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isZh
                ? "此页面仅限超级管理员或已配置负责部门的部门负责人使用。"
                : "このページはスーパー管理者、または担当部署が設定された部門責任者のみ利用できます。"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="h-6 w-6" />
            {isZh ? "员工账号管理" : "スタッフアカウント管理"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {access.isSuperAdmin
              ? isZh
                ? "全公司员工账号、角色和权限管理"
                : "全社のスタッフアカウント・ロール・権限管理"
              : isZh
                ? `仅管理 ${access.managedDepartment} 部门员工账号`
                : `${access.managedDepartment} のスタッフアカウントのみ管理`}
          </p>
        </div>
        <Badge
          variant="outline"
          className={access.isSuperAdmin ? "border-rose-300 text-rose-700" : "border-violet-300 text-violet-700"}
        >
          {access.isSuperAdmin ? <Crown className="h-3.5 w-3.5 mr-1" /> : <Building2 className="h-3.5 w-3.5 mr-1" />}
          {isZh
            ? USER_MANAGEMENT_LEVEL_LABELS[access.level].zh
            : USER_MANAGEMENT_LEVEL_LABELS[access.level].ja}
        </Badge>
      </div>

      <Tabs defaultValue="accounts" className="w-full">
        <TabsList>
          <TabsTrigger value="accounts" className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {isZh ? "员工账号" : "スタッフアカウント"}
          </TabsTrigger>
          {access.isSuperAdmin && (
            <>
              <TabsTrigger value="roles" className="flex items-center gap-1.5">
                <Shield className="h-4 w-4" />
                {isZh ? "角色管理" : "ロール管理"}
              </TabsTrigger>
              <TabsTrigger value="permissions" className="flex items-center gap-1.5">
                <Lock className="h-4 w-4" />
                {isZh ? "权限配置" : "権限設定"}
              </TabsTrigger>
              <TabsTrigger value="requests" className="flex items-center gap-1.5">
                <Bell className="h-4 w-4" />
                {isZh ? "权限申请" : "権限申請"}
              </TabsTrigger>
            </>
          )}
       </TabsList>

        <TabsContent value="accounts">
          <AccountsTab isZh={isZh} currentUser={currentUser} access={access} />
        </TabsContent>
        {access.isSuperAdmin && (
          <>
            <TabsContent value="roles">
              <RolesTab isZh={isZh} />
            </TabsContent>
            <TabsContent value="permissions">
              <PermissionsTab isZh={isZh} />
            </TabsContent>
            <TabsContent value="requests">
              <RequestsTab isZh={isZh} />
            </TabsContent>
          </>
        )}
     </Tabs>
    </div>
  );
}

// ===== Tab 1: Accounts =====
function AccountsTab({
  isZh,
  currentUser,
  access,
}: {
  isZh: boolean;
  currentUser: any;
  access: ManagementAccess;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");
  const [levelFilter, setLevelFilter] = useState<"all" | EffectiveUserManagementLevel>("all");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [roleAssignDialog, setRoleAssignDialog] = useState<{ userId: number; userName: string } | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [levelDialog, setLevelDialog] = useState<{
    userId: number;
    userName: string;
    department: string | null;
    currentLevel: UserManagementLevel;
  } | null>(null);
  const [selectedManagementLevel, setSelectedManagementLevel] = useState<UserManagementLevel>("employee");

  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.userManagement.list.useQuery({
    search: search || undefined,
    statusFilter,
    levelFilter,
  });

  const rolesQuery = trpc.rbac.listRoles.useQuery(undefined, {
    enabled: access.isSuperAdmin,
  });

  const updateManagementLevelMutation = trpc.userManagement.updateManagementLevel.useMutation({
    onSuccess: () => {
      toast.success(isZh ? "账号层级已更新" : "アカウント階層を更新しました");
      utils.userManagement.list.invalidate();
      utils.userManagement.myAccess.invalidate();
      utils.rbac.myPermissions.invalidate();
      setLevelDialog(null);
    },
    onError: (err) => toast.error(err.message),
  });
  const disableMutation = trpc.userManagement.disable.useMutation({
    onSuccess: () => { toast.success(isZh ? "操作成功" : "操作完了"); utils.userManagement.list.invalidate(); setConfirmAction(null); },
    onError: (err) => toast.error(err.message),
  });
  const enableMutation = trpc.userManagement.enable.useMutation({
    onSuccess: () => { toast.success(isZh ? "操作成功" : "操作完了"); utils.userManagement.list.invalidate(); setConfirmAction(null); },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.userManagement.delete.useMutation({
    onSuccess: () => { toast.success(isZh ? "操作成功" : "操作完了"); utils.userManagement.list.invalidate(); setConfirmAction(null); },
    onError: (err) => toast.error(err.message),
  });
  const syncNamesMutation = trpc.userManagement.syncNames.useMutation({
    onSuccess: (data) => { toast.success(isZh ? `同步完成，更新了 ${data.updatedCount} 个` : `同期完了、${data.updatedCount}件更新`); utils.userManagement.list.invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const assignRoleMutation = trpc.rbac.assignUserRole.useMutation({
    onSuccess: () => { toast.success(isZh ? "角色分配成功" : "ロール割り当て完了"); utils.userManagement.list.invalidate(); utils.rbac.myPermissions.invalidate(); setRoleAssignDialog(null); },
    onError: (err) => toast.error(err.message),
  });
  const removeRoleMutation = trpc.rbac.removeUserRole.useMutation({
    onSuccess: () => { toast.success(isZh ? "角色已移除" : "ロール解除完了"); utils.userManagement.list.invalidate(); utils.rbac.myPermissions.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  const handleConfirm = () => {
    if (!confirmAction) return;
    switch (confirmAction.type) {
      case "delete": deleteMutation.mutate({ userId: confirmAction.userId }); break;
      case "disable": disableMutation.mutate({ userId: confirmAction.userId }); break;
      case "enable": enableMutation.mutate({ userId: confirmAction.userId }); break;
    }
  };

  const isActionLoading = disableMutation.isPending || enableMutation.isPending || deleteMutation.isPending;

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Stats */}
      {data?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10"><Users className="h-5 w-5 text-blue-500" /></div>
            <div><p className="text-2xl font-bold">{data.stats.totalStaff}</p><p className="text-xs text-muted-foreground">{isZh ? "可管理账号" : "管理対象"}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-500/10"><UserCheck className="h-5 w-5 text-slate-600" /></div>
            <div><p className="text-2xl font-bold">{data.stats.employeeCount}</p><p className="text-xs text-muted-foreground">{isZh ? "员工" : "スタッフ"}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10"><Building2 className="h-5 w-5 text-violet-600" /></div>
            <div><p className="text-2xl font-bold">{data.stats.departmentManagerCount}</p><p className="text-xs text-muted-foreground">{isZh ? "部门负责人" : "部門責任者"}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/10"><Crown className="h-5 w-5 text-rose-600" /></div>
            <div><p className="text-2xl font-bold">{data.stats.superAdminCount}</p><p className="text-xs text-muted-foreground">{isZh ? "超级管理员" : "スーパー管理者"}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><UserCheck className="h-5 w-5 text-green-500" /></div>
            <div><p className="text-2xl font-bold">{data.stats.activeCount}</p><p className="text-xs text-muted-foreground">{isZh ? "活跃" : "アクティブ"}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10"><UserX className="h-5 w-5 text-red-500" /></div>
            <div><p className="text-2xl font-bold">{data.stats.disabledCount}</p><p className="text-xs text-muted-foreground">{isZh ? "已禁用" : "無効"}</p></div>
          </CardContent></Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
         <Input placeholder={isZh ? "按邮箱、姓名或部门搜索..." : "メール・名前・部署で検索..."} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={levelFilter} onValueChange={(value) => setLevelFilter(value as "all" | EffectiveUserManagementLevel)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isZh ? "全部层级" : "すべての階層"}</SelectItem>
            <SelectItem value="employee">{isZh ? "员工" : "スタッフ"}</SelectItem>
            <SelectItem value="department_manager">{isZh ? "部门负责人" : "部門責任者"}</SelectItem>
            <SelectItem value="super_admin">{isZh ? "超级管理员" : "スーパー管理者"}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isZh ? "全部状态" : "すべての状態"}</SelectItem>
            <SelectItem value="active">{isZh ? "活跃" : "アクティブ"}</SelectItem>
            <SelectItem value="disabled">{isZh ? "已禁用" : "無効"}</SelectItem>
          </SelectContent>
        </Select>
        {access.isSuperAdmin && (
          <Button variant="outline" size="sm" onClick={() => syncNamesMutation.mutate()} disabled={syncNamesMutation.isPending}>
            <UserCheck className="h-4 w-4 mr-1" />{isZh ? "同步HR" : "HR同期"}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" />{isZh ? "刷新" : "更新"}
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !data?.users.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground"><Users className="h-10 w-10 mb-2 opacity-50" /><p>{isZh ? "未找到" : "見つかりません"}</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                   <TableHead>{isZh ? "邮箱" : "メール"}</TableHead>
                   <TableHead>{isZh ? "姓名" : "名前"}</TableHead>
                   <TableHead>{isZh ? "部门" : "部署"}</TableHead>
                   <TableHead>{isZh ? "职位" : "役職"}</TableHead>
                    <TableHead className="w-[150px]">{isZh ? "账号层级" : "アカウント階層"}</TableHead>
                    <TableHead className="w-[140px]">{isZh ? "功能角色" : "機能ロール"}</TableHead>
                   <TableHead className="w-[80px]">{isZh ? "状态" : "ステータス"}</TableHead>
                    <TableHead className="w-[140px]">{isZh ? "最后登录" : "最終ログイン"}</TableHead>
                    <TableHead className="w-[80px] text-right">{isZh ? "操作" : "操作"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.users.map((u) => {
                    const assignment = u.roleAssignment;
                    const managementLevel = u.managementLevel as EffectiveUserManagementLevel;
                    const canToggleAccount =
                      currentUser?.id !== u.id &&
                      (access.isSuperAdmin || managementLevel === "employee");
                    const canOpenActions =
                      currentUser?.id !== u.id &&
                      (access.isSuperAdmin || managementLevel === "employee");
                    return (
                      <TableRow key={u.id} className={u.status === "disabled" ? "opacity-60" : ""}>
                        <TableCell>
                          <span className="font-medium text-sm">{u.displayEmail}</span>
                          {u.email.startsWith("resigned_") && <span className="text-xs text-orange-500 block">{isZh ? "（已离职）" : "（退職済み）"}</span>}
                        </TableCell>
                        <TableCell className="font-medium">{u.name || "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.department || "-"}</TableCell>
                       <TableCell className="text-sm text-muted-foreground">{u.position || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              managementLevel === "super_admin"
                                ? "border-rose-300 bg-rose-50 text-rose-700"
                                : managementLevel === "department_manager"
                                  ? "border-violet-300 bg-violet-50 text-violet-700"
                                  : "border-slate-300 bg-slate-50 text-slate-700"
                            } ${access.isSuperAdmin && managementLevel !== "super_admin" ? "cursor-pointer hover:opacity-80" : ""}`}
                            onClick={() => {
                              if (!access.isSuperAdmin || managementLevel === "super_admin") return;
                              const currentLevel: UserManagementLevel =
                                managementLevel === "department_manager" ? "department_manager" : "employee";
                              setSelectedManagementLevel(currentLevel);
                              setLevelDialog({
                                userId: u.id,
                                userName: u.name || u.displayEmail,
                                department: u.department,
                                currentLevel,
                              });
                            }}
                          >
                            {managementLevel === "super_admin" ? <Crown className="h-3 w-3 mr-1" /> : managementLevel === "department_manager" ? <Building2 className="h-3 w-3 mr-1" /> : <UserCheck className="h-3 w-3 mr-1" />}
                            {isZh
                              ? USER_MANAGEMENT_LEVEL_LABELS[managementLevel].zh
                              : USER_MANAGEMENT_LEVEL_LABELS[managementLevel].ja}
                          </Badge>
                          {managementLevel === "department_manager" && u.managedDepartment && (
                            <span className="mt-1 block text-[11px] text-muted-foreground">{u.managedDepartment}</span>
                          )}
                        </TableCell>
                       <TableCell>
                         {assignment ? (
                            <Badge
                              className={`text-xs ${access.isSuperAdmin ? "cursor-pointer hover:opacity-80" : ""}`}
                              style={{ backgroundColor: assignment.roleColor, color: "#fff" }}
                              onClick={() => access.isSuperAdmin && setRoleAssignDialog({ userId: u.id, userName: u.name || u.displayEmail })}
                            >
                              {assignment.roleName}
                            </Badge>
                          ) : access.isSuperAdmin ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-muted-foreground h-6 px-2"
                              onClick={() => setRoleAssignDialog({ userId: u.id, userName: u.name || u.displayEmail })}
                            >
                              + {isZh ? "分配角色" : "ロール割当"}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.status === "active" ? "outline" : "destructive"} className="text-xs">
                            {u.status === "active" ? (isZh ? "活跃" : "有効") : (isZh ? "禁用" : "無効")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(u.lastSignedIn)}</TableCell>
                        <TableCell className="text-right">
                          {canOpenActions && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                             <DropdownMenuContent align="end">
                               {access.isSuperAdmin && managementLevel !== "super_admin" && (
                                 <DropdownMenuItem onClick={() => {
                                   const currentLevel: UserManagementLevel = managementLevel === "department_manager" ? "department_manager" : "employee";
                                   setSelectedManagementLevel(currentLevel);
                                   setLevelDialog({ userId: u.id, userName: u.name || u.displayEmail, department: u.department, currentLevel });
                                 }}>
                                   <Building2 className="h-4 w-4 mr-2 text-violet-500" />{isZh ? "设置账号层级" : "アカウント階層を設定"}
                                 </DropdownMenuItem>
                               )}
                               {access.isSuperAdmin && (
                                 <DropdownMenuItem onClick={() => setRoleAssignDialog({ userId: u.id, userName: u.name || u.displayEmail })}>
                                    <Settings className="h-4 w-4 mr-2 text-blue-500" />{isZh ? "分配功能角色" : "機能ロール割当"}
                                 </DropdownMenuItem>
                               )}
                               {access.isSuperAdmin && assignment && (
                                 <DropdownMenuItem onClick={() => removeRoleMutation.mutate({ userId: u.id })}>
                                    <ShieldOff className="h-4 w-4 mr-2 text-gray-500" />{isZh ? "移除功能角色" : "機能ロール解除"}
                                 </DropdownMenuItem>
                               )}
                                {canToggleAccount && (u.status === "active" ? (
                                  <DropdownMenuItem onClick={() => setConfirmAction({ type: "disable", userId: u.id, userName: u.name || u.displayEmail })}>
                                    <UserX className="h-4 w-4 mr-2 text-red-500" />{isZh ? "禁用账号" : "アカウント無効化"}
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => setConfirmAction({ type: "enable", userId: u.id, userName: u.name || u.displayEmail })}>
                                    <UserCheck className="h-4 w-4 mr-2 text-green-500" />{isZh ? "启用账号" : "アカウント有効化"}
                                  </DropdownMenuItem>
                                ))}
                                {access.isSuperAdmin && (
                                  <DropdownMenuItem onClick={() => setConfirmAction({ type: "delete", userId: u.id, userName: u.name || u.displayEmail })} className="text-destructive">
                                    <Trash2 className="h-4 w-4 mr-2" />{isZh ? "删除账号" : "アカウント削除"}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />{isZh ? "确认操作" : "操作確認"}</DialogTitle>
            <DialogDescription>
              {confirmAction?.type === "delete"
                ? isZh ? "确定要删除此账号吗？不可撤销。" : "本当に削除しますか？"
                : confirmAction?.type === "disable"
                  ? isZh ? "确定要禁用此账号吗？" : "無効化しますか？"
                  : isZh ? "确定要启用此账号吗？" : "有効化しますか？"}
              {confirmAction?.userName && <span className="block mt-2 font-medium text-foreground">{confirmAction.userName}</span>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={isActionLoading}>{isZh ? "取消" : "キャンセル"}</Button>
            <Button variant={confirmAction?.type === "delete" || confirmAction?.type === "disable" ? "destructive" : "default"} onClick={handleConfirm} disabled={isActionLoading}>
              {isActionLoading && <RefreshCw className="h-4 w-4 mr-1 animate-spin" />}{isZh ? "确认" : "確認"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Management hierarchy dialog */}
      <Dialog open={!!levelDialog} onOpenChange={(open) => !open && setLevelDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isZh ? "设置账号层级" : "アカウント階層を設定"}</DialogTitle>
            <DialogDescription>
              {levelDialog?.userName}
              <span className="block mt-1">
                {isZh ? "HR部门" : "HR部署"}：{levelDialog?.department || (isZh ? "未设置" : "未設定")}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select
              value={selectedManagementLevel}
              onValueChange={(value) => setSelectedManagementLevel(value as UserManagementLevel)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">
                  <div className="flex items-center gap-2"><UserCheck className="h-4 w-4" />{isZh ? "员工" : "スタッフ"}</div>
                </SelectItem>
                <SelectItem value="department_manager" disabled={!levelDialog?.department}>
                  <div className="flex items-center gap-2"><Building2 className="h-4 w-4" />{isZh ? "部门负责人" : "部門責任者"}</div>
                </SelectItem>
              </SelectContent>
            </Select>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              {selectedManagementLevel === "department_manager"
                ? isZh
                  ? `设置后只能查看并启用/禁用 ${levelDialog?.department || "未设置部门"} 的普通员工，不能管理其他部门、部门负责人或超级管理员。`
                  : `設定後は ${levelDialog?.department || "未設定部署"} の一般スタッフのみ表示・有効化・無効化できます。他部署や他の責任者、スーパー管理者は管理できません。`
                : isZh
                  ? "员工不能进入员工账号管理页面。功能访问仍由“功能角色”单独控制。"
                  : "スタッフはこの管理ページにアクセスできません。機能アクセスは「機能ロール」で個別に管理されます。"}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLevelDialog(null)}>
              {isZh ? "取消" : "キャンセル"}
            </Button>
            <Button
              onClick={() => {
                if (!levelDialog) return;
                updateManagementLevelMutation.mutate({
                  userId: levelDialog.userId,
                  managementLevel: selectedManagementLevel,
                });
              }}
              disabled={
                updateManagementLevelMutation.isPending ||
                (selectedManagementLevel === "department_manager" && !levelDialog?.department)
              }
            >
              {updateManagementLevelMutation.isPending && <RefreshCw className="h-4 w-4 mr-1 animate-spin" />}
              {isZh ? "保存层级" : "階層を保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Assignment Dialog */}
      <Dialog open={!!roleAssignDialog} onOpenChange={(open) => !open && setRoleAssignDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isZh ? "分配功能角色" : "機能ロール割り当て"}</DialogTitle>
            <DialogDescription>{roleAssignDialog?.userName}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger><SelectValue placeholder={isZh ? "选择角色..." : "ロールを選択..."} /></SelectTrigger>
              <SelectContent>
                {(rolesQuery.data as any[] || []).map((role: any) => (
                  <SelectItem key={role.id} value={String(role.id)}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color }} />
                      {role.name}
                      {role.isSystem ? " (系统)" : ""}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleAssignDialog(null)}>{isZh ? "取消" : "キャンセル"}</Button>
            <Button
              onClick={() => {
                if (roleAssignDialog && selectedRoleId) {
                  assignRoleMutation.mutate({ userId: roleAssignDialog.userId, roleId: Number(selectedRoleId) });
                }
              }}
              disabled={!selectedRoleId || assignRoleMutation.isPending}
            >
              {assignRoleMutation.isPending && <RefreshCw className="h-4 w-4 mr-1 animate-spin" />}
              {isZh ? "确认分配" : "割り当て"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Tab 2: Roles =====
function RolesTab({ isZh }: { isZh: boolean }) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#6366f1");

  const utils = trpc.useUtils();
  const rolesQuery = trpc.rbac.listRoles.useQuery();

  const createMutation = trpc.rbac.createRole.useMutation({
    onSuccess: () => { toast.success(isZh ? "角色创建成功" : "ロール作成完了"); utils.rbac.listRoles.invalidate(); setShowCreateDialog(false); setNewRoleName(""); setNewRoleDesc(""); },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.rbac.updateRole.useMutation({
    onSuccess: () => { toast.success(isZh ? "角色更新成功" : "ロール更新完了"); utils.rbac.listRoles.invalidate(); setEditingRole(null); },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.rbac.deleteRole.useMutation({
    onSuccess: () => { toast.success(isZh ? "角色已删除" : "ロール削除完了"); utils.rbac.listRoles.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  const COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#14b8a6"];

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isZh ? "角色列表" : "ロール一覧"}</h2>
        <Button onClick={() => setShowCreateDialog(true)}><Plus className="h-4 w-4 mr-1" />{isZh ? "新建角色" : "ロール作成"}</Button>
      </div>

      <div className="grid gap-3">
        {(rolesQuery.data as any[] || []).map((role: any) => (
          <Card key={role.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: role.color }} />
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {role.name}
                    {role.isSystem ? <Badge variant="secondary" className="text-xs">{isZh ? "系统" : "システム"}</Badge> : null}
                  </div>
                  {role.description && <p className="text-sm text-muted-foreground">{role.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{role.userCount || 0} {isZh ? "人" : "人"}</Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingRole(role); setNewRoleName(role.name); setNewRoleDesc(role.description || ""); setNewRoleColor(role.color || "#6366f1"); }}>
                  <Edit className="h-4 w-4" />
                </Button>
                {!role.isSystem && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm(isZh ? "确定删除？" : "削除しますか？")) deleteMutation.mutate({ id: role.id }); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Role Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{isZh ? "新建角色" : "ロール作成"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">{isZh ? "角色名称" : "ロール名"} *</label>
              <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder={isZh ? "例：运营主管" : "例：運営リーダー"} />
            </div>
            <div>
              <label className="text-sm font-medium">{isZh ? "描述" : "説明"}</label>
              <Input value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} placeholder={isZh ? "角色职责描述" : "ロールの説明"} />
            </div>
            <div>
              <label className="text-sm font-medium">{isZh ? "颜色" : "カラー"}</label>
              <div className="flex gap-2 mt-2">
                {COLORS.map(c => (
                  <button key={c} className={`w-8 h-8 rounded-full border-2 ${newRoleColor === c ? "border-foreground scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} onClick={() => setNewRoleColor(c)} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{isZh ? "取消" : "キャンセル"}</Button>
            <Button onClick={() => createMutation.mutate({ name: newRoleName, description: newRoleDesc, color: newRoleColor })} disabled={!newRoleName || createMutation.isPending}>
              {createMutation.isPending && <RefreshCw className="h-4 w-4 mr-1 animate-spin" />}{isZh ? "创建" : "作成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{isZh ? "编辑角色" : "ロール編集"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">{isZh ? "角色名称" : "ロール名"}</label>
              <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} disabled={editingRole?.isSystem} />
            </div>
            <div>
              <label className="text-sm font-medium">{isZh ? "描述" : "説明"}</label>
              <Input value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">{isZh ? "颜色" : "カラー"}</label>
              <div className="flex gap-2 mt-2">
                {COLORS.map(c => (
                  <button key={c} className={`w-8 h-8 rounded-full border-2 ${newRoleColor === c ? "border-foreground scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} onClick={() => setNewRoleColor(c)} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRole(null)}>{isZh ? "取消" : "キャンセル"}</Button>
            <Button onClick={() => updateMutation.mutate({ id: editingRole.id, name: newRoleName, description: newRoleDesc, color: newRoleColor })} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <RefreshCw className="h-4 w-4 mr-1 animate-spin" />}{isZh ? "保存" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Tab 3: Permissions =====
function PermissionsTab({ isZh }: { isZh: boolean }) {
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<Map<string, { canView: boolean; canEdit: boolean }>>(new Map());

  const rolesQuery = trpc.rbac.listRoles.useQuery();
  const permsQuery = trpc.rbac.getRolePermissions.useQuery(
    { roleId: selectedRoleId! },
    { enabled: !!selectedRoleId }
  );
  const utils = trpc.useUtils();

  const updatePermsMutation = trpc.rbac.updateRolePermissions.useMutation({
    onSuccess: () => { toast.success(isZh ? "权限保存成功" : "権限保存完了"); utils.rbac.getRolePermissions.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  // Load permissions when role changes
  useEffect(() => {
    if (permsQuery.data) {
      const map = new Map<string, { canView: boolean; canEdit: boolean }>();
      for (const p of permsQuery.data as any[]) {
        map.set(p.pageKey, { canView: !!p.canView, canEdit: !!p.canEdit });
      }
      setPermissions(map);
    }
  }, [permsQuery.data]);

  const toggleView = (pageKey: string) => {
    const current = permissions.get(pageKey) || { canView: false, canEdit: false };
    const newMap = new Map(permissions);
    if (current.canView) {
      // Turning off view also turns off edit
      newMap.set(pageKey, { canView: false, canEdit: false });
    } else {
      newMap.set(pageKey, { ...current, canView: true });
    }
    setPermissions(newMap);
  };

  const toggleEdit = (pageKey: string) => {
    const current = permissions.get(pageKey) || { canView: false, canEdit: false };
    const newMap = new Map(permissions);
    if (current.canEdit) {
      newMap.set(pageKey, { ...current, canEdit: false });
    } else {
      // Turning on edit also turns on view
      newMap.set(pageKey, { canView: true, canEdit: true });
    }
    setPermissions(newMap);
  };

  const selectAllInGroup = (group: string, checked: boolean) => {
    const newMap = new Map(permissions);
    ALL_PAGES.filter(p => p.group === group).forEach(p => {
      newMap.set(p.key, { canView: checked, canEdit: checked });
    });
    setPermissions(newMap);
  };

  const handleSave = () => {
    if (!selectedRoleId) return;
    const permsArray = Array.from(permissions.entries()).map(([pageKey, perm]) => ({
      pageKey,
      canView: perm.canView,
      canEdit: perm.canEdit,
    }));
    updatePermsMutation.mutate({ roleId: selectedRoleId, permissions: permsArray });
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{isZh ? "权限配置" : "権限設定"}</h2>
          <Select value={selectedRoleId ? String(selectedRoleId) : ""} onValueChange={(v) => setSelectedRoleId(Number(v))}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder={isZh ? "选择角色..." : "ロールを選択..."} /></SelectTrigger>
            <SelectContent>
              {(rolesQuery.data as any[] || []).map((role: any) => (
                <SelectItem key={role.id} value={String(role.id)}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color }} />
                    {role.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedRoleId && (
          <Button onClick={handleSave} disabled={updatePermsMutation.isPending}>
            {updatePermsMutation.isPending && <RefreshCw className="h-4 w-4 mr-1 animate-spin" />}
            <Save className="h-4 w-4 mr-1" />{isZh ? "保存权限" : "権限保存"}
          </Button>
        )}
      </div>

      {!selectedRoleId ? (
        <div className="text-center py-12 text-muted-foreground">
          <Lock className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>{isZh ? "请先选择一个角色来配置权限" : "ロールを選択して権限を設定してください"}</p>
        </div>
      ) : permsQuery.isLoading ? (
        <div className="flex justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="space-y-4">
          {PAGE_GROUPS.map(group => {
            const groupPages = ALL_PAGES.filter(p => p.group === group.id);
            const allChecked = groupPages.every(p => permissions.get(p.key)?.canView);
            return (
              <Card key={group.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-sm flex items-center gap-2">
                      <Checkbox checked={allChecked} onCheckedChange={(checked) => selectAllInGroup(group.id, !!checked)} />
                      {isZh ? group.label : group.labelJa}
                    </h3>
                    <span className="text-xs text-muted-foreground">{groupPages.filter(p => permissions.get(p.key)?.canView).length}/{groupPages.length}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {groupPages.map(page => {
                      const perm = permissions.get(page.key) || { canView: false, canEdit: false };
                      return (
                        <div key={page.key} className="flex items-center gap-3 p-2 rounded border bg-muted/30">
                          <Checkbox checked={perm.canView} onCheckedChange={() => toggleView(page.key)} />
                          <span className="text-sm flex-1 truncate">{isZh ? page.label : page.labelJa}</span>
                          <label className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Checkbox checked={perm.canEdit} onCheckedChange={() => toggleEdit(page.key)} className="h-3.5 w-3.5" />
                            {isZh ? "编辑" : "編集"}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== Tab 4: Permission Requests =====
function RequestsTab({ isZh }: { isZh: boolean }) {
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const utils = trpc.useUtils();

  const requestsQuery = trpc.rbac.listPermissionRequests.useQuery({ status: statusFilter });

  const approveMutation = trpc.rbac.approvePermissionRequest.useMutation({
    onSuccess: () => { toast.success(isZh ? "已批准" : "承認しました"); utils.rbac.listPermissionRequests.invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const rejectMutation = trpc.rbac.rejectPermissionRequest.useMutation({
    onSuccess: () => { toast.success(isZh ? "已拒绝" : "拒否しました"); utils.rbac.listPermissionRequests.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  const formatDate = (d: any) => d ? new Date(d).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isZh ? "权限申请列表" : "権限申請一覧"}</h2>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">{isZh ? "待审核" : "保留中"}</SelectItem>
            <SelectItem value="approved">{isZh ? "已批准" : "承認済み"}</SelectItem>
            <SelectItem value="rejected">{isZh ? "已拒绝" : "拒否済み"}</SelectItem>
            <SelectItem value="all">{isZh ? "全部" : "すべて"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {requestsQuery.isLoading ? (
        <div className="flex justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin" /></div>
      ) : !(requestsQuery.data as any[])?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Bell className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>{isZh ? "暂无申请" : "申請はありません"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(requestsQuery.data as any[]).map((req: any) => (
            <Card key={req.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{req.userName || req.userEmail}</span>
                    <Badge variant="outline" className="text-xs">{req.pageName}</Badge>
                    <Badge
                      variant={req.status === "pending" ? "secondary" : req.status === "approved" ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {req.status === "pending" ? (isZh ? "待审核" : "保留中") :
                       req.status === "approved" ? (isZh ? "已批准" : "承認済み") :
                       (isZh ? "已拒绝" : "拒否済み")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isZh ? "申请时间" : "申請日時"}: {formatDate(req.createdAt)} | {req.pageKey}
                  </p>
                </div>
                {req.status === "pending" && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => approveMutation.mutate({ requestId: req.id })}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />{isZh ? "批准" : "承認"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => rejectMutation.mutate({ requestId: req.id })}
                      disabled={rejectMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-1" />{isZh ? "拒绝" : "拒否"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
